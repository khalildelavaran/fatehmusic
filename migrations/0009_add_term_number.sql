-- ====================================================================
-- Migration 0009: add term number to registrations
--
-- Rule (from Khalil): a student registers separately for every term.
-- If they have no prior registration, this one is term 1; their next
-- registration (matched by national code) is term 2, and so on.
--
-- New rows: computed in src/pages/api/register.ts right before insert
-- (count of existing rows with the same student_national_code + 1).
--
-- Existing rows: backfilled here from registration order (created_at,
-- id as tiebreaker) per national code, so historical data gets real
-- term numbers instead of all defaulting to 1. Rows with no national
-- code on file (registrations from before migration 0007) can't be
-- matched to anyone else and are left at the default.
-- ====================================================================

ALTER TABLE registrations ADD COLUMN term INTEGER NOT NULL DEFAULT 1;

UPDATE registrations
SET term = (
  SELECT COUNT(*)
  FROM registrations AS earlier
  WHERE earlier.student_national_code = registrations.student_national_code
    AND (
      earlier.created_at < registrations.created_at
      OR (earlier.created_at = registrations.created_at AND earlier.id <= registrations.id)
    )
)
WHERE student_national_code IS NOT NULL AND student_national_code != '';
