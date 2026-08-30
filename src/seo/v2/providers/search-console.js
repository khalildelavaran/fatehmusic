/**
 * Search Console provider boundary.
 * The real adapter can be added later without changing the opportunity engine.
 */

export class NullSearchConsoleProvider {
  async getSignals(_options = {}) {
    return new Map();
  }
}

/**
 * Provider contract documentation in executable form. Implementations should
 * return Map<canonicalKey, SearchSignal> and never fabricate unavailable data.
 */
export function createSearchConsoleProvider(provider) {
  if (!provider || typeof provider.getSignals !== "function") return new NullSearchConsoleProvider();
  return provider;
}
