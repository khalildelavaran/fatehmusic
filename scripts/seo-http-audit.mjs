#!/usr/bin/env node

const SITE_ORIGIN = (process.env.SEO_SITE_URL || "https://fatehmusic.ir").replace(/\/$/, "");
const CONCURRENCY = Number(process.env.SEO_HTTP_CONCURRENCY || 6);

const errors = [];
const warnings = [];
const checked = [];

function fail(code, message) { errors.push({ code, message }); }
function warn(code, message) { warnings.push({ code, message }); }

async function fetchText(url, options = {}) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "user-agent": "FatehMusic-SEO-Audit/1.0",
        accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.8"
      },
      ...options
    });
    const body = await response.text();
    return { response, body };
  } catch (error) {
    fail("HTTP_FETCH", url + ": " + String(error));
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

  const canonical = canonicalFromHtml(body);
  if (!canonical) {
    fail("PUBLIC_CANONICAL_MISSING", url + ": canonical link missing");
  } else if (absoluteUrl(canonical) !== url) {
    fail("PUBLIC_CANONICAL_MISMATCH", url + ": canonical is " + absoluteUrl(canonical));
  }

  if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(body)) {
    warn("PUBLIC_NOINDEX", url + ": live page is noindex");
  }
}

async function checkRedirect(from, to) {
  const url = absoluteUrl(from);
  const result = await fetchText(url);
  if (!result) return;

  const { response } = result;
  checked.push({ url, status: response.status });

  if (!isRedirect(response.status)) {
    fail("REDIRECT_STATUS", from + ": expected 3xx, received " + response.status);
    return;
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
    const advertised = extractLocs(robots.body.replace(/^Sitemap:\s*/gim, "<loc>").replace(/$/gm, "</loc>"));
    if (!/Sitemap:\s*https?:\/\/[^\s]+\/sitemap-index\.xml/im.test(robots.body)) {
      warn("ROBOTS_SITEMAP_INDEX", "robots.txt does not advertise sitemap-index.xml");
    }
  }

  const index = await checkEndpoint(SITE_ORIGIN + "/sitemap-index.xml");
  const sitemapUrls = [];
  if (index?.response.status === 200) {
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
    await mapLimit(rules, CONCURRENCY, (rule) => checkRedirect(rule.from, rule.to));
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
