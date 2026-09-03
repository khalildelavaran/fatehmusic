-- SQL smoke checks for D1/local execution.
-- Run after the full migration chain has been applied.
-- Each statement returns 1 when the invariant is satisfied and 0 otherwise.

SELECT EXISTS (
  SELECT 1 FROM sqlite_master
  WHERE type = 'table' AND name = 'enrollment_sessions'
) AS enrollment_sessions_table_ok;

SELECT EXISTS (
  SELECT 1 FROM sqlite_master
  WHERE type = 'table' AND name = 'teacher_session_attendance'
) AS teacher_attendance_table_ok;

SELECT EXISTS (
  SELECT 1 FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_enrollment_sessions_one_makeup_per_original'
) AS one_makeup_index_ok;

SELECT (
  SELECT COUNT(*) FROM sqlite_master
  WHERE type = 'trigger' AND name IN (
    'trg_class_sessions_makeup_insert',
    'trg_class_sessions_makeup_update',
    'trg_enrollment_session_insert_validate',
    'trg_enrollment_session_update_validate',
    'trg_enrollment_session_makeup_insert_validate',
    'trg_enrollment_session_makeup_update_validate',
    'trg_enrollment_session_original_makeup_lock',
    'trg_teacher_session_attendance_validate',
    'trg_teacher_session_attendance_update_validate'
  )
) = 9 AS operational_triggers_ok;
