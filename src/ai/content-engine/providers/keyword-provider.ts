// Keyword-data provider adapter.
//
// The project's own rules (and the uploaded content-intelligence spec)
// are explicit: never fabricate search volume, difficulty, or trend
// numbers. The default Worker provider now consumes first-party Search Console
// impressions when available. It still reports "unavailable" rather than
// inventing a third-party volume or difficulty number. The production
// pipeline uses Search Console by default and HybridKeywordProvider when
// AHREFS_API_KEY is configured. NullKeywordProvider remains available for
// tests and explicit no-data environments; every provider still follows the
// same interface so scoring never depends on fabricated market data.

export interface KeywordSignal {
  available: boolean;
  estimatedVolume?: number;
  difficulty?: number;
  searchImpressions?: number;
  searchClicks?: number;
  searchCtr?: number;
  searchPosition?: number;
  matchedQueries?: string[];
  source: string;
}

export interface KeywordProvider {
  lookup(title: string): Promise<KeywordSignal>;
  lookupMany?(titles: string[]): Promise<KeywordSignal[]>;
}

export class NullKeywordProvider implements KeywordProvider {
  async lookup(_title: string): Promise<KeywordSignal> {
    return { available: false, source: "none" };
  }
}
