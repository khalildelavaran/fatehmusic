import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

export default defineConfig({

  /**
   * Main production domain
   * Used for:
   * - Canonical URLs
   * - Sitemap generation
   * - SEO metadata
   */
  site: "https://fatehmusic.ir",


  /**
   * Hybrid rendering:
   * - Static pages can use prerender = true
   * - Dynamic routes (API, D1, auth) run on Cloudflare Workers
   */
  output: "server",


  /**
   * URL normalization
   * Prevents duplicate URLs:
   * /teachers
   * /teachers/
   */
  trailingSlash: "never",


  /**
   * Cloudflare Workers adapter
   * Enables:
   * - D1 Database
   * - KV
   * - R2
   * - Cloudflare bindings
   */
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),


  /**
   * SEO Sitemap generation
   */
  integrations: [
    sitemap({
      filter: (page) => {
        return (
          !page.includes("/api/") &&
          !page.includes("/admin/")
        );
      }
    })
  ],


  /**
   * Better Cloudflare deployment output
   */
  build: {
    format: "directory"
  },


  /**
   * Smaller HTML output
   */
  compressHTML: true,


  /**
   * Vite optimization
   */
  vite: {
    build: {
      cssMinify: true
    }
  }

});