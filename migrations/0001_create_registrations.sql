-- ====================================================================
-- Migration 0001: create registrations table
--
-- Apply locally:  npm run db:migrate:local
-- Apply to prod:   npm run db:migrate:remote  (after wrangler d1 create)
-- ====================================================================

CREATE TABLE IF NOT EXISTS registrations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_code         TEXT NOT NULL UNIQUE,

  instrument_id         INTEGER NOT NULL,
  instrument_title      TEXT NOT NULL,
  instrument_slug       TEXT NOT NULL,

  instructor_id         INTEGER NOT NULL,
  instructor_name       TEXT NOT NULL,

  schedule_id           INTEGER NOT NULL,
  schedule_weekday      TEXT NOT NULL,
  schedule_classroom    TEXT,
  schedule_duration     INTEGER,

  student_first_name    TEXT NOT NULL,
  student_last_name     TEXT NOT NULL,
  student_mobile        TEXT NOT NULL,
  student_age           INTEGER NOT NULL,
  student_gender        TEXT NOT NULL,
  has_instrument         TEXT NOT NULL,

  -- pending | contacted | confirmed | cancelled - lets staff track
  -- follow-up status; the registration form itself only ever writes 'pending'
  status                TEXT NOT NULL DEFAULT 'pending',

  notified_telegram     INTEGER NOT NULL DEFAULT 0,
  notified_email        INTEGER NOT NULL DEFAULT 0,

  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registrations_mobile ON registrations(student_mobile);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
