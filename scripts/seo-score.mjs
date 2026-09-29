#!/usr/bin/env node
// Measured SEO score over the built site (dist/client). Deterministic; explains every lost point.
// Usage: node scripts/seo-score.mjs [--json] [--min-overall=8] [--min-page=7]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreSite, SITE_ORIGIN } from "../src/seo/v2/measured-score.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = path.join(ROOT, "dist", "client");
const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));

if (!fs.existsSync(CLIENT)) {
  console.error("dist/client not found; run `CI=true npm run build` first");
  process.exit(2);
}

const pages = new Map();
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!["_astro", "fonts", "images", "icons"].includes(entry.name)) walk(full); continue; }
    if (entry.name !== "index.html") continue;
    const rel = path.relative(CLIENT, dir).split(path.sep).join("/");
    pages.set(rel === "" ? "/" : "/" + rel, fs.readFileSync(full, "utf8"));
  }
})(CLIENT);

const sitemapRoutes = [];
for (const file of fs.readdirSync(CLIENT).filter((f) => /^sitemap-\d+\.xml$/.test(f))) {
  for (const m of fs.readFileSync(path.join(CLIENT, file), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const route = m[1].replace(SITE_ORIGIN, "").replace(/\/$/, "") || "/";
    sitemapRoutes.push(route);
  }
}
const llmsPath = path.join(CLIENT, "llms.txt");
const report = scoreSite(pages, { sitemapRoutes, llmsTxt: fs.existsSync(llmsPath) ? fs.readFileSync(llmsPath, "utf8") : null });

if (args.has("json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`SEO score (measured): ${report.overall}/10  (avg page ${report.averagePageScore}, worst page ${report.minPageScore}, ${report.pageCount} pages)`);
  for (const p of report.penalties) console.log(`  site penalty -${p.points.toFixed(2)} [${p.id}] ${p.reason}`);
  console.log("\nLowest pages:");
  for (const p of report.pages.slice(0, 8)) {
    console.log(`  ${p.score.toFixed(1)}  ${p.route}  (${p.pageType})`);
    for (const i of p.issues) console.log(`        -${i.lost} ${i.dimension}/${i.id}: ${i.reason}`);
  }
}

const minOverall = Number(args.get("min-overall") ?? NaN);
const minPage = Number(args.get("min-page") ?? NaN);
if ((Number.isFinite(minOverall) && report.overall < minOverall) || (Number.isFinite(minPage) && report.minPageScore < minPage)) {
  console.error(`SEO score gate failed (overall ${report.overall} < ${minOverall} or worst page ${report.minPageScore} < ${minPage})`);
  process.exit(1);
}
