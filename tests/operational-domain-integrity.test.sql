-- SQL integrity smoke checks for D1/local execution.
-- Run after the full migration chain has been applied.

SELECT EXISTS (
  SELECT 1 FROM pragma_table_info('enrollment_sessions') WHERE name = 'status'
) AS enrollment_status_column_ok;

SELECT EXISTS (
  SELECT 1 FROM pragma_table_info('enrollment_sessions') WHERE name = 'enrollment_term_id'
) AS enrollment_term_link_ok;

SELECT EXISTS (
  SELECT 1 FROM pragma_table_info('enrollment_sessions') WHERE name = 'makeup_for_id'
) AS enrollment_makeup_link_ok;

SELECT EXISTS (
  SELECT 1 FROM pragma_table_info('teacher_session_attendance') WHERE name = 'instructor_id'
) AS teacher_instructor_column_ok;

SELECT EXISTS (
  SELECT 1 FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_enrollment_sessions_one_makeup_per_original'
) AS one_makeup_per_original_ok;

SELECT name FROM sqlite_master
WHERE type = 'trigger'
  AND name IN (
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
ORDER BY name;
