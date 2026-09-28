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
        // Private application areas must never be advertised to crawlers.
        const PRIVATE_PREFIXES = ["/admin", "/student", "/instructor/", "/api", "/dashboard"];
        const PRIVATE_EXACT = ["/login", "/404", "/instructor", "/certificate/verify"];
        if (PRIVATE_EXACT.includes(pathname)) return false;
        return !PRIVATE_PREFIXES.some((prefix) =>
          prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(prefix + "/")
        );
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