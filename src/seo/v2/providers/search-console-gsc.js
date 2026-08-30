/**
 * Google Search Console adapter boundary.
 *
 * This adapter deliberately requires an injected transport. It never reads
 * secrets from source code and never fabricates Search Console metrics.
 * A Cloudflare-compatible transport can be supplied by the server route.
 */
import { createSearchConsoleProvider } from "./search-console.js";

export function createGoogleSearchConsoleProvider({ transport, siteUrl } = {}) {
  if (!transport || typeof transport.query !== "function") {
    return createSearchConsoleProvider(null);
  }

  return createSearchConsoleProvider({
    async getSignals({ startDate, endDate, dimensions = ["query", "page"] } = {}) {
      if (!startDate || !endDate) return new Map();
      const rows = await transport.query({ siteUrl, startDate, endDate, dimensions });
      const signals = new Map();
      for (const row of Array.isArray(rows) ? rows : []) {
        const keys = [row.page, row.query].filter(Boolean);
        if (!keys.length) continue;
        const signal = {
          available: true,
          impressions: Math.max(0, Number(row.impressions) || 0),
          clicks: Math.max(0, Number(row.clicks) || 0),
          ctr: Number(row.ctr),
          position: Number(row.position),
          source: "google-search-console",
          query: row.query || null,
          page: row.page || null
        };
        for (const key of keys) signals.set(key, signal);
      }
      return signals;
    }
  });
}
