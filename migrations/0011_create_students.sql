-- ====================================================================
-- Migration 0011: create students table (Phase 1 — پرونده جامع هنرجو)
--
-- Context: the project had no relational Student entity before this.
-- "registrations" is one row per term (a person re-registers every
-- term, see migration 0009's term-number logic), so it cannot serve as
-- the one-row-per-person record the school-management spec's Phase 1
-- asks for. national_code is already the de-facto person identifier
-- used throughout the app (student_accounts.national_code,
-- issued_certificates.national_code) -- this migration promotes it to
-- a real table instead of inventing a new identifier.
--
-- Backward compatible: no existing column is renamed or removed.
-- registrations.student_id is new and additive; every existing reader
-- of registrations.student_national_code keeps working unmodified.
--
-- Apply locally:  npm run db:migrate:local
-- Apply to prod:   npm run db:migrate:remote
-- ====================================================================

CREATE TABLE IF NOT EXISTS students (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  national_code      TEXT NOT NULL UNIQUE,

  first_name         TEXT NOT NULL DEFAULT '',
  last_name          TEXT NOT NULL DEFAULT '',
  father_name        TEXT NOT NULL DEFAULT '',
  birth_year         INTEGER,

  phone              TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  address            TEXT NOT NULL DEFAULT '',
  id_issue_place     TEXT NOT NULL DEFAULT '',
  occupation         TEXT NOT NULL DEFAULT '',
  emergency_contact  TEXT NOT NULL DEFAULT '',

  -- Free-text staff notes (Section 6) and lifecycle status (Section 40).
  -- No prior status concept existed anywhere in the project, so every
  -- backfilled row defaults to 'active' rather than a guessed value.
  notes              TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'active', -- active | inactive | graduated

  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(last_name, first_name);

-- ---------------------------------------------------------------
-- Backfill: one row per distinct national code, taking that
-- person's most recent registration as the current snapshot of
-- their contact/personal details (a later term's info is more
-- likely to be up to date than an earlier one). Rows with no
-- national code on file (registrations from before migration 0007)
-- cannot be matched to a person and are correctly left out --
-- there is nothing to key them by.
-- ---------------------------------------------------------------
INSERT INTO students (
  national_code, first_name, last_name, father_name, birth_year,
  phone, address, id_issue_place, occupation, created_at
)
SELECT
  r.student_national_code,
  r.student_first_name,
  r.student_last_name,
  r.student_father_name,
  NULLIF(r.student_birth_year, 0),
  r.student_mobile,
  r.student_address,
  r.student_id_issue_place,
  r.student_occupation,
  r.created_at
FROM registrations r
WHERE r.student_national_code IS NOT NULL
  AND r.student_national_code != ''
  AND r.id = (
    SELECT r2.id FROM registrations r2
    WHERE r2.student_national_code = r.student_national_code
    ORDER BY r2.created_at DESC, r2.id DESC
    LIMIT 1
  );

-- ---------------------------------------------------------------
-- Link registrations -> students (Section 68: internal relations
-- should use record IDs, national_code stays a lookup/search key).
-- Nullable and additive: rows with no national code on file simply
-- keep student_id = NULL, same as they have no student_accounts
-- row today either.
-- ---------------------------------------------------------------
ALTER TABLE registrations ADD COLUMN student_id INTEGER REFERENCES students(id);

UPDATE registrations
SET student_id = (
  SELECT s.id FROM students s WHERE s.national_code = registrations.student_national_code
)
WHERE student_national_code IS NOT NULL AND student_national_code != '';

CREATE INDEX IF NOT EXISTS idx_registrations_student_id ON registrations(student_id);
