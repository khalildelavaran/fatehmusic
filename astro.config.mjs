import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// ====================================================================
// IMPORTANT - read this before merging into your real project
// ====================================================================
// This project was static (`output: 'static'`, no adapter) before now.
// Adding real D1 storage requires ONE server-rendered route (the new
// /api/register endpoint), so the whole site switches to `output:
// 'server'`. Every EXISTING page needs `export const prerender = true;`
// added to its frontmatter so it keeps being built as static HTML at
// build time exactly like before (same performance, same behavior) -
// only src/pages/api/register.ts should be left dynamic
// (`prerender = false`). See MIGRATION.md for the full checklist.
// ====================================================================

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Lets `astro dev` talk to a local D1/KV/etc. simulation instead of
    // requiring a real Cloudflare account during development.
    platformProxy: {
      enabled: true
    }
  })
});
