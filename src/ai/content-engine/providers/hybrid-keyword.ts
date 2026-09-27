import type { KeywordProvider, KeywordSignal } from "./keyword-provider";
import { D1SearchConsoleKeywordProvider } from "./gsc-keyword";
import { getCachedAhrefsKeywordSignals, syncAhrefsKeywordSignals, getAhrefsConfig } from "../../../seo/v2/providers/ahrefs.js";

export class HybridKeywordProvider implements KeywordProvider {
  private db: D1Database;
  private env: Record<string, unknown>;
  private gsc: D1SearchConsoleKeywordProvider;
  private cache = new Map<string, KeywordSignal>();

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
        try {
          await syncAhrefsKeywordSignals({
            db: this.db,
            env: this.env,
            keywords: missing
          });
          ahrefsMap = await getCachedAhrefsKeywordSignals(this.db, {
            country: config.country,
            keywords: unique
          });
        } catch {
          // GSC remains the safe fallback when Ahrefs is unavailable, rate-limited, or not funded.
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
