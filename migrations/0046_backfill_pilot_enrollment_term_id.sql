-- ====================================================================
-- Migration 0046: backfill enrollment_term_id on pilot enrollment_sessions.
--
-- Migration 0045 inserted enrollment_sessions rows for the pilot dataset
-- without setting enrollment_term_id (only enrollment_id, session_id,
-- status were populated). The daily dashboard's student query joins
-- enrollment_terms via es.enrollment_term_id, so every pilot student's
-- planned_sessions came back NULL -- which the dashboard correctly
-- treats as "monthly billing" and shows a "شهریه ماهانه" badge instead
-- of a real remaining-sessions count. This was a data gap in 0045, not
-- a UI or business-logic bug: the remaining-sessions logic in
-- daily-dashboard.ts (student.billing_type === 'monthly' ||
-- student.planned_sessions == null ? null : planned - consumed) was
-- already correct and untouched.
--
-- Each pilot enrollment has exactly one enrollment_terms row (term_number
-- = 1), so this is a direct 1:1 backfill by enrollment_id.
--
-- Idempotent: safe to run more than once.
-- ====================================================================

UPDATE enrollment_sessions
SET enrollment_term_id = (
  SELECT et.id FROM enrollment_terms et WHERE et.enrollment_id = enrollment_sessions.enrollment_id
)
WHERE enrollment_term_id IS NULL
  AND enrollment_id IN (
    SELECT id FROM enrollments WHERE id >= 500000
  );
