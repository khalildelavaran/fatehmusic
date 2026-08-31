-- Google Search Console Search Analytics cache.
-- Stores normalized query/page signals so scoring and dashboard reads do not
-- require a live Google request on every page load.
CREATE TABLE IF NOT EXISTS gsc_search_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_url TEXT NOT NULL,
  query TEXT,
  page TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  clicks REAL NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'google-search-console',
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_url, query, page, start_date, end_date)
);

CREATE INDEX IF NOT EXISTS idx_gsc_signals_site_dates
  ON gsc_search_signals(site_url, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_gsc_signals_page
  ON gsc_search_signals(page);
CREATE INDEX IF NOT EXISTS idx_gsc_signals_query
  ON gsc_search_signals(query);
CREATE INDEX IF NOT EXISTS idx_gsc_signals_impressions
  ON gsc_search_signals(impressions DESC);

CREATE TABLE IF NOT EXISTS gsc_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_url TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  rows_received INTEGER NOT NULL DEFAULT 0,
  rows_stored INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_gsc_sync_runs_site_started
  ON gsc_sync_runs(site_url, started_at DESC);
