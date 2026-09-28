import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

export default defineConfig({

  site: "https://fatehmusic.ir",

  output: "server",

  trailingSlash: "never",

  adapter: cloudflare({
    // CI must build without authenticating to Cloudflare remote bindings.
    // Local development keeps remote bindings enabled for production parity.
    remoteBindings: process.env.CI !== "true"
  }),

  integrations: [
    sitemap({
      customSitemaps: ["https://fatehmusic.ir/sitemap-blog.xml"],
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, "") || "/";
        return ![
          "/login",
          "/404"
        ].includes(pathname);
      }
    })
  ],

  compressHTML: true,

  vite: {
    build: {
      cssMinify: true
    }
  }

});