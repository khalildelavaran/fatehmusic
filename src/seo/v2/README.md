## SEO/GEO engine ownership

Canonical sources of truth in `src/seo/v2` are:

- `topics.js` for topic taxonomy and resolution
- `intents.js` for intent classification
- `content-clusters.js` for article profiles, relations, and gaps
- `content-strategy.js` for unified content opportunities
- `gsc-signal-resolver.js` and `gsc-intelligence.js` for Search Console enrichment
- `opportunity-scoring.js` for action and priority scoring
- `internal-links.js` for semantic internal-link planning
- `../geo/*` for entity graph/schema relationships
- `orchestrator.js` for composition only

New features should extend these owners instead of introducing duplicate engines.
