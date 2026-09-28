-- Isolated staging area for GSC snapshots.
-- A staging table is required because gsc_search_signals_v2 has a UNIQUE key
-- that intentionally does not include snapshot_label.

CREATE TABLE IF NOT EXISTS gsc_search_signals_staging (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_url TEXT NOT NULL,
  query TEXT,
  page TEXT,
  country TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  search_appearance TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  data_state TEXT NOT NULL DEFAULT 'final',
  clicks REAL NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'google-search-console',
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  snapshot_label TEXT NOT NULL,
  UNIQUE(site_url, query, page, country, device, search_appearance, start_date, end_date, snapshot_label)
);

CREATE INDEX IF NOT EXISTS idx_gsc_staging_snapshot
  ON gsc_search_signals_staging(site_url, snapshot_label, start_date, end_date);
