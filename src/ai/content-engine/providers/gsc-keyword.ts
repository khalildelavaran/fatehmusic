import type { KeywordProvider, KeywordSignal } from "./keyword-provider";

const DEFAULT_SITE_URL = "https://fatehmusic.ir";

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[؟?!.,،؛:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const GENERIC_QUERY_TERMS = new Set(["آموزش", "موسیقی", "کلاس", "دوره", "شوشتر", "فاتح", "یادگیری", "مدرس"]);

const GENERIC_TOKENS = new Set([
  "آموزش", "کلاس", "دوره", "موسیقی", "در", "به", "از", "برای", "و",
  "یا", "با", "را", "این", "یک", "چه", "چگونه", "چطور", "شوشتر"
]);

function tokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !GENERIC_TOKENS.has(token))
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

interface GscKeywordProviderOptions {
  db: D1Database;
  siteUrl?: string;
  days?: number;
  limit?: number;
}

interface QuerySignalRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export class D1SearchConsoleKeywordProvider implements KeywordProvider {
  private db: D1Database;
  private siteUrl: string;
  private days: number;
  private limit: number;
  private rowsPromise?: Promise<QuerySignalRow[]>;

  constructor(options: GscKeywordProviderOptions) {
    this.db = options.db;
    this.siteUrl = String(options.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "");
    this.days = options.days ?? 60;
    this.limit = options.limit ?? 3000;
  }

  private loadRows(): Promise<QuerySignalRow[]> {
    if (this.rowsPromise) return this.rowsPromise;

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - this.days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    this.rowsPromise = this.db.prepare(
      "SELECT query, SUM(clicks) AS clicks, SUM(impressions) AS impressions, " +
      "CASE WHEN SUM(impressions) > 0 THEN SUM(impressions * position) / SUM(impressions) ELSE 0 END AS position " +
      "FROM gsc_search_signals_v2 " +
      "WHERE site_url = ? AND start_date >= ? AND snapshot_label = 'current' AND country = '' AND device = '' AND search_appearance = '' " +
      "AND query IS NOT NULL AND query != '' GROUP BY query ORDER BY impressions DESC LIMIT ?"
    ).bind(this.siteUrl, cutoffDate, this.limit).all<QuerySignalRow>().then((result) =>
      (result.results || []).map((row) => ({
        query: String(row.query || ""),
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        position: Number(row.position) || 0
      }))
    );

    return this.rowsPromise;
  }

  private async lookupFromRows(title: string, rows: QuerySignalRow[]): Promise<KeywordSignal> {
    const target = tokens(title);
    if (!target.size) return { available: false, source: "google-search-console" };

    const normalizedTitle = normalize(title);
    const matches = rows
      .map((row) => {
        const normalizedQuery = normalize(row.query);
        const queryTokens = tokens(row.query);
        const isGenericSingleTerm = queryTokens.size === 1 && [...queryTokens].every((token) => GENERIC_QUERY_TERMS.has(token));
        const similarity = !isGenericSingleTerm && normalizedTitle.includes(normalizedQuery) && queryTokens.size >= 1
          ? 1
          : overlap(target, queryTokens);
        return { row, similarity: similarity >= 0.34 ? similarity : 0 };
      })
      .filter((item) => item.similarity > 0)
      .sort((a, b) => b.similarity * b.row.impressions - a.similarity * a.row.impressions)
      .slice(0, 8);

    if (!matches.length) return { available: false, source: "google-search-console" };

    const weighted = matches.reduce((acc, item) => {
      const weight = item.similarity;
      acc.impressions += item.row.impressions * weight;
      acc.clicks += item.row.clicks * weight;
      const position = Number(item.row.position);
      if (item.row.impressions > 0 && Number.isFinite(position) && position > 0) {
        acc.positionNumerator += item.row.impressions * position * weight;
        acc.positionImpressions += item.row.impressions * weight;
      }
      return acc;
    }, { impressions: 0, clicks: 0, positionNumerator: 0, positionImpressions: 0 });

    return {
      available: weighted.impressions > 0,
      searchImpressions: weighted.impressions,
      searchClicks: weighted.clicks,
      searchCtr: weighted.impressions ? weighted.clicks / weighted.impressions : 0,
      searchPosition: weighted.positionImpressions ? weighted.positionNumerator / weighted.positionImpressions : undefined,
      matchedQueries: matches.map((item) => item.row.query),
      source: "google-search-console"
    };
  }

  async lookup(title: string): Promise<KeywordSignal> {
    return this.lookupFromRows(title, await this.loadRows());
  }

  async lookupMany(titles: string[]): Promise<KeywordSignal[]> {
    const rows = await this.loadRows();
    return Promise.all(titles.map((title) => this.lookupFromRows(title, rows)));
  }
}
