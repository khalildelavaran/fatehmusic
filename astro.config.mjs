import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

export default defineConfig({

  site: "https://fatehmusic.ir",

  output: "server",

  trailingSlash: "never",

  adapter: cloudflare(),

  integrations: [
    sitemap()
  ],

  compressHTML: true,

  vite: {
    build: {
      cssMinify: true
    }
  }

});