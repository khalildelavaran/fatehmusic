-- ====================================================================
-- Migration 0043: permanently DELETE all synthetic test data.
--
-- Migration 0040 tried to deactivate the seeded test dataset, but:
--   1. It only matched classes titled 'تست — دوره %'. It missed the
--      'تست — پوشش استاد %' (instructor coverage) classes created by
--      migration 0033, which is why they are still live today.
--   2. It never touched the `enrollments` table, so even the classes it
--      did deactivate still had their active enrollments intact.
--   3. Migrations 0041 and 0042 then explicitly RE-activated everything
--      0040 had turned off, intended for an isolated test/CI database.
--      This project only has a single D1 database, so 0041/0042 ended
--      up restoring the full synthetic dataset onto the live production
--      site.
--
-- As of this migration, no real (non-test) classes or students have ever
-- been entered into this installation, so there is no history to
-- preserve. This migration DELETEs every row created by migrations
-- 0032-0036, identified the same way those migrations mark their own
-- rows: the 'TEST DATA' marker in `notes` (classes/students), which
-- every dependent row traces back to via class_id / student_id /
-- enrollment_id / session_id.
--
-- This version deliberately avoids PRAGMA statements and CREATE TEMP
-- TABLE (an earlier version using PRAGMA defer_foreign_keys and temp
-- tables triggered "not authorized: SQLITE_AUTH" when applied remotely
-- via `wrangler d1 migrations apply --remote`). Instead, every DELETE
-- uses a direct subquery and statements are manually ordered
-- child-before-parent so foreign key constraints are never violated at
-- any point, with no need to defer anything.
--
-- Idempotent: safe to run more than once (all WHERE clauses simply
-- match zero rows the second time).
-- ====================================================================

DELETE FROM evaluations WHERE enrollment_id IN (
  SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
) OR session_id IN (
  SELECT id FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
);

DELETE FROM assignments WHERE enrollment_id IN (
  SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
) OR session_id IN (
  SELECT id FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
);

DELETE FROM makeup_requests WHERE enrollment_id IN (
  SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
) OR original_enrollment_session_id IN (
  SELECT id FROM enrollment_sessions WHERE session_id IN (
    SELECT id FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
  )
) OR makeup_session_id IN (
  SELECT id FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
);

DELETE FROM teacher_session_attendance WHERE session_id IN (
  SELECT id FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
);

DELETE FROM enrollment_sessions WHERE session_id IN (
  SELECT id FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
) OR enrollment_id IN (
  SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
);

DELETE FROM payments WHERE invoice_id IN (
  SELECT i.id FROM invoices i
  WHERE i.enrollment_term_id IN (
    SELECT id FROM enrollment_terms WHERE enrollment_id IN (
      SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
    )
  )
);

DELETE FROM invoices WHERE enrollment_term_id IN (
  SELECT id FROM enrollment_terms WHERE enrollment_id IN (
    SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
  )
);

DELETE FROM term_renewal_requests WHERE enrollment_id IN (
  SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
) OR student_id IN (
  SELECT id FROM students WHERE notes LIKE '%TEST DATA%' OR national_code LIKE '99%'
);

DELETE FROM new_course_requests WHERE student_id IN (
  SELECT id FROM students WHERE notes LIKE '%TEST DATA%' OR national_code LIKE '99%'
);

DELETE FROM enrollment_terms WHERE enrollment_id IN (
  SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%')
);

DELETE FROM class_sessions WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%');

DELETE FROM enrollments WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%');

DELETE FROM class_students WHERE class_id IN (
  SELECT id FROM classes WHERE notes LIKE '%TEST DATA%'
) OR student_id IN (
  SELECT id FROM students WHERE notes LIKE '%TEST DATA%' OR national_code LIKE '99%'
);

DELETE FROM class_schedules WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%');

DELETE FROM class_term_settings WHERE class_id IN (SELECT id FROM classes WHERE notes LIKE '%TEST DATA%');

DELETE FROM classes WHERE notes LIKE '%TEST DATA%';

DELETE FROM students WHERE notes LIKE '%TEST DATA%' OR national_code LIKE '99%';
