// Keyword-data provider adapter.
//
// The project's own rules (and the uploaded content-intelligence spec)
// are explicit: never fabricate search volume, difficulty, or trend
// numbers. No such provider is wired into this Cloudflare Worker today
// (no Ahrefs/Google Trends API key is configured as a secret here), so
// the default implementation honestly reports "unavailable" rather than
// inventing a number. Swap NullKeywordProvider for a real implementation
// (e.g. an Ahrefs API v3 client, keyed by a new AHREFS_API_KEY secret)
// once one is actually connected -- everything else in the engine only
// depends on this interface, not on any specific provider.

export interface KeywordSignal {
  available: boolean;
  estimatedVolume?: number;
  difficulty?: number; // 0-100
  source: string;
}

export interface KeywordProvider {
  lookup(title: string): Promise<KeywordSignal>;
}

export class NullKeywordProvider implements KeywordProvider {
  async lookup(_title: string): Promise<KeywordSignal> {
    return { available: false, source: "none" };
  }
}
