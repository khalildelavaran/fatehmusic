-- ====================================================================
-- Migration 0033: operational lookup indexes
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_class_schedules_class_day
  ON class_schedules(class_id, day_of_week, start_time);

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_session_status
  ON enrollment_sessions(session_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_makeup_for
  ON enrollment_sessions(makeup_for_id);

CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_session_status
  ON teacher_session_attendance(session_id, status);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date
  ON calendar_exceptions(exception_date);
