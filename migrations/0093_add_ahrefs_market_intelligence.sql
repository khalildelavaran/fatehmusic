-- Optional Ahrefs market intelligence cache.
CREATE TABLE IF NOT EXISTS seo_keyword_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  keyword TEXT NOT NULL,
  country TEXT NOT NULL,
  volume INTEGER,
  volume_monthly INTEGER,
  difficulty INTEGER,
  traffic_potential INTEGER,
  cpc INTEGER,
  intents TEXT,
  serp_features TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, keyword, country)
);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_signals_lookup
  ON seo_keyword_signals(source, country, keyword);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_signals_volume
  ON seo_keyword_signals(country, volume_monthly DESC);

CREATE TABLE IF NOT EXISTS seo_market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  snapshot_type TEXT NOT NULL,
  target TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  snapshot_date TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, snapshot_type, target, country, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_seo_market_snapshots_lookup
  ON seo_market_snapshots(source, snapshot_type, target, snapshot_date DESC);
