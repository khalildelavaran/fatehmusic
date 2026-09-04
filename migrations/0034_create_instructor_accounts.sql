-- ====================================================================
-- Migration 0034: instructor accounts
--
-- Adds login credentials for Instructor self-service (Phase 11,
-- Instructor Portal). Mirrors student_accounts (0010) rather than
-- adding login columns onto `instructors` directly, keeping the
-- static/public instructor profile separate from private credentials.
-- ====================================================================

CREATE TABLE IF NOT EXISTS instructor_accounts (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id         INTEGER NOT NULL UNIQUE REFERENCES instructors(id) ON DELETE CASCADE,
  username              TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  must_change_password  INTEGER NOT NULL DEFAULT 1,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_instructor_accounts_instructor ON instructor_accounts(instructor_id);
