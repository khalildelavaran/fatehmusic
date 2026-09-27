-- ====================================================================
-- Migration 0047: make pilot class_schedules recur every week going
-- forward, not just for the original 2026-09-15..21 pilot window.
--
-- Migration 0045 intentionally capped every pilot class_schedules row
-- at effective_to = '2026-09-21' (the user only wanted that one test
-- week covered at the time). materializeScheduledSessions()
-- (src/pages/api/admin/daily-dashboard.ts) correctly honors that cap --
-- "AND (cs.effective_to IS NULL OR cs.effective_to >= ?)" -- so once
-- the 2026-09-21 week passed, no new sessions were generated for these
-- classes on any later week. That is the real cause of "a student who
-- has class every week showed up last Monday, but not the following
-- Monday": the materializer is working correctly, the pilot schedule
-- data was simply time-boxed to one week on purpose.
--
-- This clears effective_to (making the weekly recurrence open-ended,
-- same as a real student's ongoing weekly schedule would be) for every
-- pilot class_schedules row, while leaving effective_from untouched so
-- no sessions are (re)materialized for dates before the pilot started.
--
-- Idempotent: safe to run more than once.
-- ====================================================================

UPDATE class_schedules
SET effective_to = NULL
WHERE effective_to = '2026-09-21'
  AND class_id IN (SELECT id FROM classes WHERE notes LIKE '%PILOT DATA%');
