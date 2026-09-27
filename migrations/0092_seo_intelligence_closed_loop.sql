-- SEO Intelligence v2: dimension-aware GSC cache + closed-loop measurements.

CREATE TABLE IF NOT EXISTS gsc_search_signals_v2 (
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
  UNIQUE(site_url, query, page, country, device, search_appearance, start_date, end_date)
);

INSERT OR IGNORE INTO gsc_search_signals_v2
(site_url, query, page, country, device, search_appearance, start_date, end_date, data_state, clicks, impressions, ctr, position, source, synced_at)
SELECT site_url, query, page, '', '', '', start_date, end_date, 'final', clicks, impressions, ctr, position, source, synced_at
FROM gsc_search_signals;

CREATE INDEX IF NOT EXISTS idx_gsc_v2_site_dates
  ON gsc_search_signals_v2(site_url, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_gsc_v2_page
  ON gsc_search_signals_v2(site_url, page);
CREATE INDEX IF NOT EXISTS idx_gsc_v2_query
  ON gsc_search_signals_v2(site_url, query);
CREATE INDEX IF NOT EXISTS idx_gsc_v2_dims
  ON gsc_search_signals_v2(site_url, country, device, search_appearance);
CREATE INDEX IF NOT EXISTS idx_gsc_v2_impressions
  ON gsc_search_signals_v2(impressions DESC);

CREATE TABLE IF NOT EXISTS seo_action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,
  target_url TEXT,
  target_slug TEXT,
  target_title TEXT,
  related_course_slug TEXT,
  recommendation_score REAL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  source TEXT NOT NULL DEFAULT 'seo-engine',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  completed_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_seo_actions_status
  ON seo_action_log(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_actions_target
  ON seo_action_log(target_url);

CREATE TABLE IF NOT EXISTS seo_action_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id INTEGER NOT NULL,
  measured_at TEXT NOT NULL DEFAULT (datetime('now')),
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  impressions REAL NOT NULL DEFAULT 0,
  clicks REAL NOT NULL DEFAULT 0,
  ctr REAL NOT NULL DEFAULT 0,
  position REAL,
  source TEXT NOT NULL DEFAULT 'google-search-console',
  metadata TEXT,
  UNIQUE(action_id, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_seo_action_measurements_action
  ON seo_action_measurements(action_id, measured_at DESC);
