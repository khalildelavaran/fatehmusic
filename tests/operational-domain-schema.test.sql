-- SQL smoke-test cases for D1/local execution.
-- Run against a database after the full migration chain has been applied.

SELECT CASE
  WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='enrollment_sessions')
  THEN 1 ELSE RAISE(ABORT, 'ENROLLMENT_SESSIONS_TABLE_MISSING') END;

SELECT CASE
  WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='teacher_session_attendance')
  THEN 1 ELSE RAISE(ABORT, 'TEACHER_ATTENDANCE_TABLE_MISSING') END;

SELECT CASE
  WHEN (SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN (
    'trg_class_sessions_makeup_insert',
    'trg_class_sessions_makeup_update',
    'trg_enrollment_sessions_validate_insert',
    'trg_enrollment_sessions_validate_update',
    'trg_enrollment_sessions_makeup_insert',
    'trg_enrollment_sessions_makeup_update',
    'trg_teacher_attendance_validate_insert',
    'trg_teacher_attendance_validate_update'
  )) = 8
  THEN 1 ELSE RAISE(ABORT, 'OPERATIONAL_TRIGGERS_MISSING') END;
