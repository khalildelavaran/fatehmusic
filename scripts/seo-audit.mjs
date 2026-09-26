#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const SITE_ORIGIN = "https://fatehmusic.ir";
const PRIVATE_PREFIXES = ["/admin", "/student", "/instructor", "/dashboard", "/api"];
const SKIP_ROUTES = new Set(["/404"]);
const errors = [];
const warnings = [];

function error(code, message) { errors.push({ code, message }); }
function warn(code, message) { warnings.push({ code, message }); }

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function normalizeRoute(value) {
  try {
    const url = new URL(value, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN) return null;
    const decoded = decodeURIComponent(url.pathname);
    return decoded.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

function routeFromHtml(file) {
  const rel = path.relative(DIST, file).replaceAll(path.sep, "/");
  let route = rel.replace(/(?:^|\/)index\.html$/, "");
  if (route === rel && rel.endsWith(".html")) route = rel.slice(0, -5);
  if (!route.startsWith("/")) route = "/" + route;
  return normalizeRoute(route);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(re, html) { return html.match(re)?.[1]?.trim() ?? ""; }
function allMatches(re, html) { return [...html.matchAll(re)].map((m) => m[1] ?? ""); }

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function readRedirects() {
  const files = [path.join(ROOT, "_redirects"), path.join(ROOT, "public", "_redirects")];
  const file = files.find((item) => fs.existsSync(item));
  const map = new Map();
  if (!file) return map;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const from = normalizeRoute(parts[0]);
    const to = normalizeRoute(parts[1]);
    if (!from || !to) continue;
    if (map.has(from)) error("DUPLICATE_REDIRECT", "duplicate redirect source: " + from);
    map.set(from, { to, status: parts[2] || "301" });
  }
  return map;
}

function validateRedirects(redirects) {
  for (const [from] of redirects) {
    let current = from;
    const visited = new Set();
    let hops = 0;
    while (redirects.has(current)) {
      if (visited.has(current)) {
        error("REDIRECT_LOOP", "redirect loop detected from " + from);
        break;
      }
      visited.add(current);
      current = redirects.get(current).to;
      hops += 1;
      if (hops > 1) {
        error("REDIRECT_CHAIN", "redirect chain detected from " + from + " to " + current);
        break;
      }
    }
  }
}

function schemaTypes(node) {
  return Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
}

function validateSchema(route, scripts) {
  if (scripts.length !== 1) {
    error("JSONLD_SCRIPT_COUNT", route + ": expected exactly one JSON-LD script, found " + scripts.length);
    return;
  }

  let graph;
  try {
    graph = JSON.parse(scripts[0]);
  } catch {
    error("JSONLD_INVALID", route + ": JSON-LD is not valid JSON");
    return;
  }

  if (!graph || !Array.isArray(graph["@graph"])) {
    error("JSONLD_GRAPH_MISSING", route + ": JSON-LD @graph missing");
    return;
  }

  const nodes = graph["@graph"];
  const ids = new Set();
  const types = new Set();

  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      error("JSONLD_NODE_INVALID", route + ": schema graph contains a non-object node");
      continue;
    }
    if (!node["@id"]) {
      error("JSONLD_ID_MISSING", route + ": schema node missing @id");
    } else if (ids.has(node["@id"])) {
      error("JSONLD_DUPLICATE_ID", route + ": duplicate @id " + node["@id"]);
    } else {
      ids.add(node["@id"]);
    }

    for (const type of schemaTypes(node)) if (type) types.add(type);
  }

  if (!types.has("WebSite")) error("JSONLD_WEBSITE_MISSING", route + ": WebSite entity missing");
  if (![...types].some((type) => ["Organization", "LocalBusiness", "EducationalOrganization"].includes(type))) {
    error("JSONLD_ORGANIZATION_MISSING", route + ": Organization/LocalBusiness/EducationalOrganization entity missing");
  }
  if (!nodes.some((node) => schemaTypes(node).includes("WebPage"))) {
    error("JSONLD_WEBPAGE_MISSING", route + ": WebPage entity missing");
  }

  for (const node of nodes) {
    const type = schemaTypes(node);
    if (type.includes("Article") && !node.author) {
      error("ARTICLE_AUTHOR_MISSING", route + ": Article author missing");
    }
    if (type.includes("BreadcrumbList") && (!Array.isArray(node.itemListElement) || node.itemListElement.length < 2)) {
      error("BREADCRUMB_TOO_SHORT", route + ": BreadcrumbList needs at least two items");
    }
    if (type.includes("Course")) {
      for (const field of ["name", "description", "url"]) {
        if (!node[field]) error("COURSE_FIELD_MISSING", route + ": Course " + field + " missing");
      }
    }
    if (type.includes("LocalBusiness")) {
      for (const field of ["name", "address", "telephone"]) {
        if (!node[field]) error("LOCALBUSINESS_FIELD_MISSING", route + ": LocalBusiness " + field + " missing");
      }
    }
  }
}

function collectSitemapUrls() {
  const xmlFiles = walk(DIST).filter((file) => file.endsWith(".xml"));
  const urls = new Set();
  for (const file of xmlFiles) {
    const xml = fs.readFileSync(file, "utf8");
    if (/<sitemapindex\b/i.test(xml)) continue;
    for (const loc of allMatches(/<loc>\s*([^<]+?)\s*<\/loc>/gi, xml)) {
      const route = normalizeRoute(loc);
      if (route) urls.add(route);
    }
  }
  return { urls, files: xmlFiles };
}

function validateHtmlFiles() {
  const htmlFiles = walk(DIST).filter((file) => file.endsWith(".html"));
  if (htmlFiles.length === 0) {
    error("NO_RENDERED_HTML", "no rendered HTML files found in dist");
    return { pages: new Map() };
  }

  const pages = new Map();

  for (const file of htmlFiles) {
    const route = routeFromHtml(file);
    if (!route || SKIP_ROUTES.has(route)) continue;
    if (PRIVATE_PREFIXES.some((prefix) => route === prefix || route.startsWith(prefix + "/"))) continue;

    const html = fs.readFileSync(file, "utf8");
    const title = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
    const descriptions = allMatches(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/gi, html);
    const canonicals = allMatches(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/gi, html);
    const robots = firstMatch(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["'][^>]*>/i, html);
    const h1s = allMatches(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, html);
    const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => parseAttributes(m[0]));
    const jsonLd = allMatches(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, html);
    const anchors = allMatches(/<a\b[^>]+href=["']([^"'#]+)["']/gi, html);

    if (!title) error("TITLE_MISSING", route + ": title missing");
    if (descriptions.length !== 1 || !descriptions[0]) {
      error("META_DESCRIPTION", route + ": expected exactly one non-empty meta description");
    }
    if (canonicals.length !== 1) error("CANONICAL_COUNT", route + ": expected exactly one canonical");
    if (h1s.length !== 1) error("H1_COUNT", route + ": expected exactly one H1, found " + h1s.length);
    if (robots.toLowerCase().includes("noindex")) warn("NOINDEX_PUBLIC", route + ": public rendered page is noindex");

    for (const attrs of imageTags) {
      if (!("alt" in attrs)) error("IMAGE_ALT_MISSING", route + ": image missing alt attribute");
      if (!attrs.width || !attrs.height) warn("IMAGE_DIMENSIONS", route + ": image missing width/height");
    }

    if (canonicals[0] && normalizeRoute(canonicals[0]) !== route) {
      error("CANONICAL_MISMATCH", route + ": canonical points to " + canonicals[0]);
    }

    if (stripHtml(html).length < 120) warn("THIN_RENDERED_TEXT", route + ": rendered visible text is very short");
    validateSchema(route, jsonLd);

    pages.set(route, {
      file,
      html,
      anchors,
      title,
      description: descriptions[0] || ""
    });
  }

  const titleMap = new Map();
  const descriptionMap = new Map();

  for (const [route, page] of pages) {
    const title = page.title.trim().toLocaleLowerCase("fa");
    const description = page.description.trim().toLocaleLowerCase("fa");
    if (title) {
      const list = titleMap.get(title) || [];
      list.push(route);
      titleMap.set(title, list);
    }
    if (description) {
      const list = descriptionMap.get(description) || [];
      list.push(route);
      descriptionMap.set(description, list);
    }
  }

  for (const [title, routes] of titleMap) {
    if (routes.length > 1) error("DUPLICATE_TITLE", "duplicate title on: " + routes.join(", "));
  }
  for (const [description, routes] of descriptionMap) {
    if (routes.length > 1) error("DUPLICATE_DESCRIPTION", "duplicate description on: " + routes.join(", "));
  }

  return { pages };
}

function validateLinks(pages, redirects) {
  const routes = new Set(pages.keys());
  const inbound = new Map([...routes].map((route) => [route, 0]));

  function targetRoute(href) {
    if (!href || /^(?:mailto:|tel:|javascript:)/i.test(href)) return null;
    let route = href;
    try {
      if (/^https?:\/\//i.test(href)) {
        const url = new URL(href);
        if (url.origin !== SITE_ORIGIN) return null;
        route = url.pathname;
      }
    } catch {
      return null;
    }
    return normalizeRoute(route);
  }

  for (const [route, page] of pages) {
    for (const href of page.anchors) {
      const target = targetRoute(href);
      if (!target || /^(?:\/images|\/icons)\//.test(target)) continue;

      if (routes.has(target)) {
        if (target !== route) inbound.set(target, inbound.get(target) + 1);
        continue;
      }

      if (redirects.has(target)) {
        warn("INTERNAL_REDIRECT_LINK", route + ": internal link points to redirect " + target);
        continue;
      }

      if (/\.(?:xml|txt|svg|webp|png|jpg|jpeg|ico)$/i.test(target)) continue;
      error("BROKEN_INTERNAL_LINK", route + ": internal link target not found: " + target);
    }
  }

  for (const [route, count] of inbound) {
    if (route !== "/" && count === 0) error("ORPHAN_PAGE", "orphan rendered page: " + route);
  }
}

function validateSitemaps(pages) {
  const sitemapData = collectSitemapUrls();
  if (sitemapData.urls.size === 0) {
    error("SITEMAP_EMPTY", "no URLs found across generated XML sitemaps");
    return;
  }

  for (const route of pages.keys()) {
    if (!route || route === "/" || route.startsWith("/blog/")) continue;
    if (!sitemapData.urls.has(route)) error("PAGE_MISSING_FROM_SITEMAP", route + ": not present in sitemap");
  }

  for (const route of sitemapData.urls) {
    if (route.startsWith("/blog/")) continue;
    if (!pages.has(route) && !PRIVATE_PREFIXES.some((prefix) => route === prefix || route.startsWith(prefix + "/"))) {
      error("SITEMAP_URL_NOT_RENDERED", "sitemap references route not present in rendered build: " + route);
    }
  }
}

function report() {
  console.log("[SEO AUDIT] " + (errors.length ? "FAIL" : warnings.length ? "WARN" : "PASS"));
  console.log("Rendered pages: " + (globalThis.__SEO_PAGE_COUNT || 0));
  console.log("Errors: " + errors.length);
  console.log("Warnings: " + warnings.length);
  for (const item of errors) console.error("ERROR [" + item.code + "] " + item.message);
  for (const item of warnings) console.warn("WARN  [" + item.code + "] " + item.message);
  if (errors.length) process.exitCode = 1;
}

function main() {
  if (!fs.existsSync(DIST)) {
    error("DIST_MISSING", "dist directory does not exist; run npm run build first");
    report();
    return;
  }

  const robotsFile = path.join(ROOT, "public", "robots.txt");
  if (fs.existsSync(robotsFile)) {
    const robots = fs.readFileSync(robotsFile, "utf8");
    if (!/User-agent:\s*\*/i.test(robots)) error("ROBOTS_DEFAULT_AGENT", "robots.txt has no default User-agent rule");
    if (!/Sitemap:\s*https:\/\/fatehmusic\.ir\/sitemap-index\.xml/i.test(robots)) warn("ROBOTS_SITEMAP_INDEX", "robots.txt does not advertise sitemap-index.xml");
  } else {
    error("ROBOTS_MISSING", "public/robots.txt is missing");
  }

  const redirects = readRedirects();
  validateRedirects(redirects);
  const pages = validateHtmlFiles().pages;
  globalThis.__SEO_PAGE_COUNT = pages.size;
  validateLinks(pages, redirects);
  validateSitemaps(pages);
  report();
}

const thisFile = path.resolve(new URL(import.meta.url).pathname);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) main();

export {
  normalizeRoute,
  routeFromHtml,
  validateRedirects,
  validateSchema,
  collectSitemapUrls
};
