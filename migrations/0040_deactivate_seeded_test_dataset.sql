-- Deactivates the synthetic test dataset introduced in migration 0032
-- (230 test students, 23 dedicated test classes, one per course) so it no
-- longer appears on the daily dashboard alongside real classes.
--
-- Why deactivate instead of delete: these rows are referenced by
-- enrollments, enrollment_terms, invoices, payments and class_sessions
-- created since 0032 was applied (including in real, deployed academies
-- that have been running with this seed data live). Deleting could violate
-- foreign keys or silently destroy financial/attendance history that some
-- installs may have already accumulated against these rows. Deactivating
-- is reversible and immediately removes them from the operational daily
-- dashboard and from future automatic session generation, without
-- touching history.
--
-- This does not touch real classes/students/schedules -- everything here
-- is scoped to the exact rows migration 0032 created, identified the same
-- way 0032 identifies them: title = 'تست — دوره %' for classes, and the
-- 'TEST DATA' marker in notes for students.

UPDATE classes
SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
WHERE title LIKE 'تست — دوره %'
  AND notes LIKE '%TEST DATA%';

UPDATE class_schedules
SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id FROM classes WHERE title LIKE 'تست — دوره %' AND notes LIKE '%TEST DATA%'
);

-- Cancel (not delete) any class_sessions already materialized for these
-- test classes -- e.g. for "today" on whichever day this migration
-- happens to run -- so they stop showing up on the daily dashboard
-- immediately, while preserving any attendance/finance rows that already
-- reference them.
UPDATE class_sessions
SET status = 'cancelled', notes = notes || ' | غیرفعال‌شده به‌صورت خودکار: کلاس تستی', updated_at = CURRENT_TIMESTAMP
WHERE status NOT IN ('cancelled', 'completed')
  AND class_id IN (
    SELECT id FROM classes WHERE title LIKE 'تست — دوره %' AND notes LIKE '%TEST DATA%'
  );

UPDATE students
SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
WHERE notes LIKE '%TEST DATA%';
