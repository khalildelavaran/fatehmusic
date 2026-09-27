import type { KeywordProvider, KeywordSignal } from "./keyword-provider";
import { D1SearchConsoleKeywordProvider } from "./gsc-keyword";
import { getCachedAhrefsKeywordSignals, syncAhrefsKeywordSignals, getAhrefsConfig } from "../../../seo/v2/providers/ahrefs.js";

export class HybridKeywordProvider implements KeywordProvider {
  private db: D1Database;
  private env: Record<string, unknown>;
  private gsc: D1SearchConsoleKeywordProvider;
  private cache = new Map<string, KeywordSignal>();

  private getAhrefsLookupLimit(): number {
    const value = Number(this.env.AHREFS_MAX_KEYWORDS_PER_RUN ?? 200);
    return Math.max(25, Math.min(Number.isFinite(value) ? value : 200, 500));
  }

  constructor(db: D1Database, env: Record<string, unknown> = {}) {
    this.db = db;
    this.env = env;
    this.gsc = new D1SearchConsoleKeywordProvider({ db });
  }

  async lookup(title: string): Promise<KeywordSignal> {
    const [result] = await this.lookupMany([title]);
    return result || { available: false, source: "none" };
  }

  async lookupMany(titles: string[]): Promise<KeywordSignal[]> {
    const unique = [...new Set(titles.map((value) => String(value || "").trim()).filter(Boolean))];
    const config = getAhrefsConfig(this.env);
    let ahrefsMap = new Map();

    if (config.enabled) {
      ahrefsMap = await getCachedAhrefsKeywordSignals(this.db, {
        country: config.country,
        keywords: unique
      });

      const missing = unique.filter((title) => !ahrefsMap.has(title));
      if (missing.length) {
        // Do not let one scheduled discovery run explode into an unbounded
        // number of paid Ahrefs keyword lookups. Fresh cached signals remain
        // preferred; only a bounded sample is refreshed, and all other
        // candidates safely fall back to Search Console.
        const refreshable = missing.slice(0, this.getAhrefsLookupLimit());
        try {
          await syncAhrefsKeywordSignals({
            db: this.db,
            env: this.env,
            keywords: refreshable
          });
          ahrefsMap = await getCachedAhrefsKeywordSignals(this.db, {
            country: config.country,
            keywords: unique
          });
        } catch {
          // GSC remains the safe fallback when Ahrefs is unavailable,
          // rate-limited, not funded, or temporarily fails.
        }
      }
    }

    const results = [];
    for (const title of unique) {
      const ahrefs = ahrefsMap.get(title);
      if (ahrefs) {
        results.push(ahrefs);
        this.cache.set(title, ahrefs);
        continue;
      }
      const gsc = await this.gsc.lookup(title);
      results.push(gsc);
      this.cache.set(title, gsc);
    }

    return results;
  }
}
