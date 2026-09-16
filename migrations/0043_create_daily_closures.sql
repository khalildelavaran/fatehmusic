-- ====================================================================
-- Migration 0043: daily operation closures
--
-- Persists the explicit close-day action separately from the derived
-- end-of-day report. One row is allowed per school day.
-- ====================================================================

CREATE TABLE IF NOT EXISTS daily_closures (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  close_date TEXT NOT NULL UNIQUE,
  closed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  metadata   TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_daily_closures_close_date ON daily_closures(close_date);
CREATE INDEX IF NOT EXISTS idx_daily_closures_closed_by ON daily_closures(closed_by);
