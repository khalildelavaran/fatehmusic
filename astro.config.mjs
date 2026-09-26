import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

export default defineConfig({

  site: "https://fatehmusic.ir",

  output: "server",

  trailingSlash: "never",

  adapter: cloudflare({\n    // CI must build without authenticating to Cloudflare remote bindings.\n    // Local development keeps remote bindings enabled for production parity.\n    remoteBindings: process.env.CI !== "true"\n  }),

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