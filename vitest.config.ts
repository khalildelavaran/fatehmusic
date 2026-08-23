import { defineConfig } from "vitest/config";

// Deliberately minimal: only the pure content-engine logic is unit
// tested here (no D1/KV/Workers AI bindings involved), so plain Node is
// enough -- no need for the Astro/Cloudflare vite integration.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"]
  }
});
