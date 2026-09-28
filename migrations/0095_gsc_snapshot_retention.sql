-- Keep only named GSC reporting snapshots in the SEO decision layer.
-- The scheduler refreshes "current" and "previous" instead of accumulating
-- overlapping rolling 28-day windows that would double-count impressions.

ALTER TABLE gsc_search_signals_v2
  ADD COLUMN snapshot_label TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_gsc_v2_snapshot
  ON gsc_search_signals_v2(site_url, snapshot_label, start_date, end_date);

-- Rows written by the new scheduler use current/previous/breakdowns-current.
-- Existing pre-snapshot rows remain as legacy for rollback/audit purposes but
-- are intentionally excluded from scoring and dashboard aggregations.
