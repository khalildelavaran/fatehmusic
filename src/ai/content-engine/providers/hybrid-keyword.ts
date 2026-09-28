import type { KeywordProvider, KeywordSignal } from "./keyword-provider";
import { D1SearchConsoleKeywordProvider } from "./gsc-keyword";
import { getCachedAhrefsKeywordSignals, syncAhrefsKeywordSignals, getAhrefsConfig } from "../../../seo/v2/providers/ahrefs.js";

function cacheKey(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa");
}

function signalValue(signal: KeywordSignal | undefined): number {
  const volume = Number(signal?.estimatedVolume);
  const difficulty = Number(signal?.difficulty);
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  if (!Number.isFinite(difficulty)) return volume;
  return volume * Math.max(0.1, 1 - difficulty / 150);
}

/**
 * Hybrid demand provider:
 * - First-party GSC supplies the queries real users already used.
 * - Ahrefs supplies market volume/difficulty for those real queries.
 * - The long article title itself is still queried as a fallback, but it is
 *   no longer treated as the only keyword worth measuring.
 */
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
    const unique = [...new Set(
      titles.map((value) => String(value || "").trim()).filter(Boolean)
    )];
    if (!unique.length) return [];

    let gscSignals: KeywordSignal[] = [];
    try {
      gscSignals = await this.gsc.lookupMany(unique);
    } catch (error) {
      // Ahrefs must remain usable when Search Console is absent, stale, or
      // temporarily unavailable. GSC is enrichment, not a hard dependency.
      console.warn("[hybrid-keyword] GSC enrichment unavailable:", error);
    }
    const gscByTitle = new Map(unique.map((title, index) => [
      cacheKey(title),
      gscSignals[index] || { available: false, source: "none" }
    ]));

    const pending = unique.filter((title) => !this.cache.has(cacheKey(title)));
    const config = getAhrefsConfig(this.env);

    if (config.enabled && pending.length) {
      const keywordCandidates = new Map<string, string[]>();
      for (const title of pending) {
        const gsc = gscByTitle.get(cacheKey(title));
        const candidates = [...new Set([
          title,
          ...(gsc?.matchedQueries || []).slice(0, 4)
        ].map((value) => String(value || "").trim()).filter(Boolean))];
        keywordCandidates.set(cacheKey(title), candidates);
      }

      const allKeywords = [...new Set(
        [...keywordCandidates.values()].flat().map(cacheKey)
      )].map((key) => {
        for (const values of keywordCandidates.values()) {
          const original = values.find((value) => cacheKey(value) === key);
          if (original) return original;
        }
        return key;
      });

      let ahrefsMap = new Map<string, KeywordSignal>();
      try {
        ahrefsMap = await getCachedAhrefsKeywordSignals(this.db, {
          country: config.country,
          keywords: allKeywords
        });
      } catch (error) {
        // A cache read failure should degrade to GSC/unavailable, not fail
        // the entire topic discovery run.
        console.warn("[hybrid-keyword] Ahrefs cache unavailable:", error);
      }

      const missing = allKeywords.filter((keyword) => !ahrefsMap.has(keyword));
      if (missing.length) {
        // Bound paid lookups per discovery run while preferring real GSC
        // queries over synthetic keyword guesses.
        const refreshable = missing.slice(0, this.getAhrefsLookupLimit());
        try {
          await syncAhrefsKeywordSignals({
            db: this.db,
            env: this.env,
            keywords: refreshable
          });
          try {
            ahrefsMap = await getCachedAhrefsKeywordSignals(this.db, {
              country: config.country,
              keywords: allKeywords
            });
          } catch (error) {
            console.warn("[hybrid-keyword] Ahrefs cache refresh unavailable:", error);
          }
        } catch {
          // Search Console remains the authoritative fallback.
        }
      }

      for (const title of pending) {
        const candidates = keywordCandidates.get(cacheKey(title)) || [title];
        const scored = candidates
          .map((keyword) => ({ keyword, signal: ahrefsMap.get(keyword) }))
          .filter((item) => item.signal)
          .sort((a, b) => signalValue(b.signal) - signalValue(a.signal));

        if (scored.length) {
          const selected = scored[0];
          const base = selected.signal as KeywordSignal;
          this.cache.set(cacheKey(title), {
            ...base,
            matchedQueries: [...new Set([
              ...(base.matchedQueries || []),
              ...candidates
            ])].slice(0, 8)
          });
        }
      }
    }

    return unique.map((title) => {
      const key = cacheKey(title);
      const cached = this.cache.get(key);
      if (cached) return cached;

      const gsc = gscByTitle.get(key);
      const fallback = gsc || { available: false, source: "none" };
      this.cache.set(key, fallback);
      return fallback;
    });
  }
}
