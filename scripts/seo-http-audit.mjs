#!/usr/bin/env node

const SITE_ORIGIN = (process.env.SEO_SITE_URL || "https://fatehmusic.ir").replace(/\/$/, "");
const CONCURRENCY = Number(process.env.SEO_HTTP_CONCURRENCY || 6);
const HTTP_TIMEOUT_MS = Math.max(1000, Number(process.env.SEO_HTTP_TIMEOUT_MS || 15000));

const errors = [];
const warnings = [];
const checked = [];

function fail(code, message) { errors.push({ code, message }); }
function warn(code, message) { warnings.push({ code, message }); }

async function fetchText(url, options = {}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.SEO_HTTP_TIMEOUT_MS || 15000));
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers: {
          "user-agent": "FatehMusic-SEO-Audit/1.0",
          accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.8"
        },
        signal: controller.signal,
        ...options
      });
      const body = await response.text();
      return { response, body };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const detail = error?.name === "TimeoutError"
      ? `timeout after ${HTTP_TIMEOUT_MS}ms`
      : String(error);
    fail("HTTP_FETCH", url + ": " + detail);
    return null;
  }
}

function absoluteUrl(value) {
  return new URL(value, SITE_ORIGIN).toString();
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function canonicalFromHtml(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || null;
}

function allMatches(re, html) {
  return [...html.matchAll(re)].map((match) => match[1] ?? "");
}

function firstMatch(re, html) {
  return html.match(re)?.[1]?.trim() || "";
}

function jsonLdIsValidGraph(html) {
  const scripts = allMatches(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, html);
  if (scripts.length !== 1) {
    return { ok: false, reason: "expected exactly one JSON-LD script, found " + scripts.length };
  }
  try {
    const graph = JSON.parse(scripts[0]);
    if (!graph || !Array.isArray(graph["@graph"]) || graph["@graph"].length < 3) {
      return { ok: false, reason: "JSON-LD graph is missing or too small" };
    }
    const ids = new Set();
    for (const node of graph["@graph"]) {
      if (!node || typeof node !== "object" || !node["@id"]) {
        return { ok: false, reason: "JSON-LD node is invalid or missing @id" };
      }
      if (ids.has(node["@id"])) {
        return { ok: false, reason: "duplicate JSON-LD @id: " + node["@id"] };
      }
      ids.add(node["@id"]);
    }
    return { ok: true, graph };
  } catch {
    return { ok: false, reason: "JSON-LD is not valid JSON" };
  }
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

async function checkEndpoint(url, expectedStatuses = [200]) {
  const result = await fetchText(url);
  if (!result) return null;

  const { response } = result;
  checked.push({ url, status: response.status });

  if (!expectedStatuses.includes(response.status)) {
    fail("HTTP_STATUS", url + ": expected " + expectedStatuses.join("/") + ", received " + response.status);
  }

  return result;
}

async function checkPublicPage(url) {
  const result = await fetchText(url);
  if (!result) return;
  const { response, body } = result;
  checked.push({ url, status: response.status });

  if (response.status !== 200) {
    fail("PUBLIC_STATUS", url + ": expected 200, received " + response.status);
    return;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) {
    fail("PUBLIC_CONTENT_TYPE", url + ": expected text/html, received " + contentType);
  }

  const canonical = canonicalFromHtml(body);
  if (!canonical) {
    fail("PUBLIC_CANONICAL_MISSING", url + ": canonical link missing");
  } else if (absoluteUrl(canonical).replace(/\/$/, "") !== url.replace(/\/$/, "")) {
    fail("PUBLIC_CANONICAL_MISMATCH", url + ": canonical is " + absoluteUrl(canonical));
  }

  const htmlTag = firstMatch(/<html\b([^>]*)>/i, body);
  if (!/\blang=["']fa["']/i.test(htmlTag) || !/\bdir=["']rtl["']/i.test(htmlTag)) {
    fail("PUBLIC_HTML_LANGUAGE", url + ': expected <html lang="fa" dir="rtl">');
  }

  const titles = allMatches(/<title[^>]*>([\s\S]*?)<\/title>/gi, body);
  if (titles.length !== 1 || !titles[0].trim()) {
    fail("PUBLIC_TITLE", url + ": expected exactly one non-empty title");
  } else if (titles[0].trim().length < 20 || titles[0].trim().length > 60) {
    warn("PUBLIC_TITLE_LENGTH", url + ": title length is outside 20-60 characters");
  }

  const descriptions = allMatches(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/gi, body)
    .filter(Boolean);
  if (descriptions.length !== 1) {
    fail("PUBLIC_META_DESCRIPTION", url + ": expected exactly one non-empty meta description");
  } else if (descriptions[0].length < 80 || descriptions[0].length > 160) {
    warn("PUBLIC_META_DESCRIPTION_LENGTH", url + ": meta description length is outside 80-160 characters");
  }

  const h1s = allMatches(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, body);
  if (h1s.length !== 1) {
    fail("PUBLIC_H1", url + ": expected exactly one H1, found " + h1s.length);
  }

  const ogTitle = firstMatch(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i, body);
  const ogDescription = firstMatch(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i, body);
  const ogUrl = firstMatch(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']*)["'][^>]*>/i, body);
  const ogImage = firstMatch(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["'][^>]*>/i, body);
  const twitterCard = firstMatch(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["'][^>]*>/i, body);

  if (!ogTitle || !ogDescription || !ogImage) {
    fail("PUBLIC_SOCIAL_META", url + ": required Open Graph metadata is incomplete");
  }
  if (ogUrl && absoluteUrl(ogUrl).replace(/\/$/, "") !== url.replace(/\/$/, "")) {
    fail("PUBLIC_OG_URL_MISMATCH", url + ": og:url is " + absoluteUrl(ogUrl));
  }
  if (ogImage && !/^https?:\/\//i.test(ogImage)) {
    fail("PUBLIC_OG_IMAGE_NOT_ABSOLUTE", url + ": og:image is not an absolute URL");
  }
  if (!twitterCard) {
    fail("PUBLIC_TWITTER_CARD", url + ": twitter:card is missing");
  }

  const schema = jsonLdIsValidGraph(body);
  if (!schema.ok) {
    fail("PUBLIC_JSONLD", url + ": " + schema.reason);
  }

  const xRobotsTag = response.headers.get("x-robots-tag") || "";
  if (/noindex/i.test(xRobotsTag)) {
    fail("PUBLIC_X_ROBOTS_NOINDEX", url + ": X-Robots-Tag contains noindex");
  }

  if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(body)) {
    fail("PUBLIC_NOINDEX", url + ": live page is noindex but is present in sitemap");
  }

}

async function checkRedirect(from, to, expectedStatus) {
  const url = absoluteUrl(from);
  const result = await fetchText(url);
  if (!result) return;

  const { response } = result;
  checked.push({ url, status: response.status });

  if (!isRedirect(response.status)) {
    fail("REDIRECT_STATUS", from + ": expected 3xx, received " + response.status);
    return;
  }
  if (expectedStatus != null && response.status !== Number(expectedStatus)) {
    fail("REDIRECT_STATUS_MISMATCH", from + ": expected " + expectedStatus + ", received " + response.status);
  }

  const location = response.headers.get("location");
  if (!location) {
    fail("REDIRECT_LOCATION_MISSING", from + ": redirect has no Location header");
    return;
  }

  const resolved = absoluteUrl(location).replace(/\/$/, "") || SITE_ORIGIN;
  const expected = absoluteUrl(to).replace(/\/$/, "") || SITE_ORIGIN;
  if (resolved !== expected) {
    fail("REDIRECT_TARGET", from + ": expected " + expected + ", received " + resolved);
  }
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function readRedirectsFromRaw(raw) {
  const rules = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;
    const from = parts[0];
    const to = parts[1];
    const status = parts[2];
    if (!from.startsWith("/") || !to.startsWith("/")) continue;
    if (!/^(301|302|307|308)$/.test(status)) continue;
    rules.push({ from, to, status: Number(status) });
  }
  return rules;
}

async function main() {
  console.log("[SEO LIVE AUDIT] " + SITE_ORIGIN);

  const robots = await checkEndpoint(SITE_ORIGIN + "/robots.txt");
  if (robots) {
    if (!/^User-agent:\s*\*/im.test(robots.body)) fail("ROBOTS_DEFAULT_AGENT", "robots.txt has no default User-agent rule");
    if (!/Sitemap:\s*https?:\/\/[^\s]+\/sitemap-index\.xml/im.test(robots.body)) {
      warn("ROBOTS_SITEMAP_INDEX", "robots.txt does not advertise sitemap-index.xml");
    }
  }

  const index = await checkEndpoint(SITE_ORIGIN + "/sitemap-index.xml");
  const sitemapUrls = [];
  if (index?.response.status === 200) {
    if (!/https?:\/\/[^\s<"]*\/sitemap-blog\.xml(?:\?|<|\s|$)/i.test(index.body)) {
      fail("SITEMAP_INDEX_BLOG_MISSING", "sitemap-index.xml does not advertise sitemap-blog.xml");
    }

    const locs = extractLocs(index.body);
    const childSitemaps = locs.filter((loc) => /\.xml$/i.test(loc));
    for (const sitemap of childSitemaps) {
      const child = await checkEndpoint(absoluteUrl(sitemap));
      if (!child || child.response.status !== 200) continue;
      sitemapUrls.push(...extractLocs(child.body));
    }
  }

  const blog = await checkEndpoint(SITE_ORIGIN + "/sitemap-blog.xml");
  if (blog?.response.status === 200) sitemapUrls.push(...extractLocs(blog.body));

  const uniquePages = [...new Set(sitemapUrls)]
    .map((url) => absoluteUrl(url).replace(/\/$/, ""))
    .filter((url) => url.startsWith(SITE_ORIGIN) && !/\/sitemap[^/]*\.xml$/i.test(url));

  await mapLimit(uniquePages, CONCURRENCY, checkPublicPage);

  const redirectsPath = new URL("../_redirects", import.meta.url);
  try {
    const fs = await import("node:fs/promises");
    const url = await import("node:url");
    const filePath = url.fileURLToPath(redirectsPath);
    const raw = await fs.readFile(filePath, "utf8");
    const rules = readRedirectsFromRaw(raw);
    await mapLimit(rules, CONCURRENCY, (rule) => checkRedirect(rule.from, rule.to, rule.status));
  } catch (error) {
    warnings.push({ code: "REDIRECT_FILE_UNAVAILABLE", message: String(error) });
  }

  console.log("[SEO LIVE AUDIT] " + (errors.length ? "FAIL" : warnings.length ? "WARN" : "PASS"));
  console.log("Checked URLs: " + checked.length);
  console.log("Sitemap pages: " + uniquePages.length);
  console.log("Errors: " + errors.length);
  console.log("Warnings: " + warnings.length);

  for (const item of errors) console.error("ERROR [" + item.code + "] " + item.message);
  for (const item of warnings) console.warn("WARN  [" + item.code + "] " + item.message);

  if (errors.length) process.exitCode = 1;
}

main();
