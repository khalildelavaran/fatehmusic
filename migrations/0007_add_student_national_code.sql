-- ====================================================================
-- Migration 0007: add Iranian national code to registrations
-- ====================================================================

ALTER TABLE registrations ADD COLUMN student_national_code TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_registrations_national_code
  ON registrations(student_national_code);
