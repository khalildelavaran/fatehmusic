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
--      0040 had turned off (their own header comments say so), intended
--      for an isolated test/CI database. This project only has a single
--      D1 database (see wrangler.jsonc), so 0041/0042 ended up restoring
--      the full synthetic dataset (230 students, 34 classes, thousands
--      of sessions/enrollment_sessions) onto the live production site.
--
-- As of this migration, no real (non-test) classes or students have ever
-- been entered into this installation, so there is no history to
-- preserve. Rather than deactivate (which would still show a "cancelled"
-- tag in the daily dashboard), this migration DELETEs every row created
-- by migrations 0032-0036, identified the same way those migrations
-- mark their own rows: the 'TEST DATA' marker in `notes`
-- (classes/students), which every dependent row traces back to via
-- class_id / student_id / enrollment_id / session_id.
--
-- PRAGMA defer_foreign_keys is used so the deletes below don't have to
-- be hand-ordered against every FK in the schema; D1/SQLite checks
-- referential integrity once at the end of the transaction instead of
-- after each statement. See:
-- https://developers.cloudflare.com/d1/sql-api/foreign-keys/
--
-- Idempotent: safe to run more than once (all WHERE clauses simply
-- match zero rows the second time).
-- ====================================================================

PRAGMA defer_foreign_keys = on;

-- Snapshot which classes/students are TEST DATA before anything is
-- deleted, since later steps can't re-derive it once earlier rows are
-- gone (notes on classes/students are the only source of truth for the
-- marker; everything else is reached by walking FKs from these two).
CREATE TEMP TABLE IF NOT EXISTS _test_class_ids AS
  SELECT id FROM classes WHERE notes LIKE '%TEST DATA%';

CREATE TEMP TABLE IF NOT EXISTS _test_student_ids AS
  SELECT id FROM students WHERE notes LIKE '%TEST DATA%' OR national_code LIKE '99%';

CREATE TEMP TABLE IF NOT EXISTS _test_enrollment_ids AS
  SELECT id FROM enrollments WHERE class_id IN (SELECT id FROM _test_class_ids);

CREATE TEMP TABLE IF NOT EXISTS _test_session_ids AS
  SELECT id FROM class_sessions WHERE class_id IN (SELECT id FROM _test_class_ids);

CREATE TEMP TABLE IF NOT EXISTS _test_enrollment_term_ids AS
  SELECT id FROM enrollment_terms WHERE enrollment_id IN (SELECT id FROM _test_enrollment_ids);

-- Leaf / dependent tables first (order doesn't strictly matter with
-- defer_foreign_keys on, but this keeps the file readable top-down).
--
-- Note: student_accounts (keyed by national_code, no FK to students) and
-- issued_certificates (keyed by registration_id -> registrations, an
-- unrelated public-signup flow) are NOT touched here -- neither has any
-- foreign key relationship to the classes/students/enrollments rows
-- this migration targets. enrollment_sessions_v2 and
-- teacher_session_attendance_v2 (created in 0026/0030) were immediately
-- ALTER TABLE ... RENAME TO'd onto their non-_v2 names in those same
-- migrations, so no table with the _v2 suffix actually exists today.
DELETE FROM evaluations WHERE enrollment_id IN (SELECT id FROM _test_enrollment_ids)
  OR session_id IN (SELECT id FROM _test_session_ids);
DELETE FROM assignments WHERE enrollment_id IN (SELECT id FROM _test_enrollment_ids)
  OR session_id IN (SELECT id FROM _test_session_ids);
DELETE FROM makeup_requests WHERE enrollment_id IN (SELECT id FROM _test_enrollment_ids)
  OR original_enrollment_session_id IN (
    SELECT id FROM enrollment_sessions WHERE session_id IN (SELECT id FROM _test_session_ids)
  )
  OR makeup_session_id IN (SELECT id FROM _test_session_ids);
DELETE FROM teacher_session_attendance WHERE session_id IN (SELECT id FROM _test_session_ids);
DELETE FROM enrollment_sessions WHERE session_id IN (SELECT id FROM _test_session_ids)
  OR enrollment_id IN (SELECT id FROM _test_enrollment_ids);
DELETE FROM payments WHERE invoice_id IN (
  SELECT id FROM invoices WHERE enrollment_term_id IN (SELECT id FROM _test_enrollment_term_ids)
);
DELETE FROM invoices WHERE enrollment_term_id IN (SELECT id FROM _test_enrollment_term_ids);
DELETE FROM term_renewal_requests WHERE enrollment_id IN (SELECT id FROM _test_enrollment_ids)
  OR student_id IN (SELECT id FROM _test_student_ids);
DELETE FROM new_course_requests WHERE student_id IN (SELECT id FROM _test_student_ids);

DELETE FROM enrollment_terms WHERE id IN (SELECT id FROM _test_enrollment_term_ids);
DELETE FROM class_sessions WHERE id IN (SELECT id FROM _test_session_ids);
DELETE FROM enrollments WHERE id IN (SELECT id FROM _test_enrollment_ids);

DELETE FROM class_students WHERE class_id IN (SELECT id FROM _test_class_ids)
  OR student_id IN (SELECT id FROM _test_student_ids);
DELETE FROM class_schedules WHERE class_id IN (SELECT id FROM _test_class_ids);
DELETE FROM class_term_settings WHERE class_id IN (SELECT id FROM _test_class_ids);

DELETE FROM classes WHERE id IN (SELECT id FROM _test_class_ids);
DELETE FROM students WHERE id IN (SELECT id FROM _test_student_ids);

DROP TABLE _test_class_ids;
DROP TABLE _test_student_ids;
DROP TABLE _test_enrollment_ids;
DROP TABLE _test_session_ids;
DROP TABLE _test_enrollment_term_ids;

PRAGMA defer_foreign_keys = off;
