import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";


export default defineConfig({

  site: "https://fatehmusic.ir",

  output: "server",

  trailingSlash: "never",

  adapter: cloudflare(),

  compressHTML: true,

  vite:{
    build:{
      cssMinify:true
    }
  }

});