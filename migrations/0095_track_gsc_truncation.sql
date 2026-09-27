-- Preserve whether a Search Console sync hit its configured row cap.
ALTER TABLE gsc_sync_runs ADD COLUMN truncated INTEGER NOT NULL DEFAULT 0;
