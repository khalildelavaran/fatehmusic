-- SQL smoke-test cases for D1/local execution.
-- These statements are intentionally non-destructive when wrapped in a test
-- transaction by the test runner.

-- Canonical status vocabulary.
SELECT 1 AS ok
WHERE NOT EXISTS (
  SELECT 1 FROM pragma_table_info('enrollment_sessions')
  WHERE name = 'status'
);

-- Required operational indexes/triggers should exist after migrations.
SELECT name FROM sqlite_master
WHERE type = 'trigger'
  AND name IN (
    'trg_class_sessions_makeup_insert',
    'trg_class_sessions_makeup_update',
    'trg_enrollment_sessions_validate_insert',
    'trg_enrollment_sessions_validate_update',
    'trg_enrollment_sessions_makeup_insert',
    'trg_enrollment_sessions_makeup_update',
    'trg_teacher_attendance_validate_insert',
    'trg_teacher_attendance_validate_update'
  )
ORDER BY name;
