-- Final integrity constraints for the operational education domain.
-- Keep schedule as the recurring plan; class_sessions remain the source of truth
-- for actual date/time/room/instructor changes and makeup sessions.

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_sessions_unique
  ON enrollment_sessions(enrollment_id, session_id);

CREATE INDEX IF NOT EXISTS idx_class_sessions_daily
  ON class_sessions(session_date, start_time, status);

CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date
  ON class_sessions(class_id, session_date);

CREATE INDEX IF NOT EXISTS idx_class_sessions_makeup_source
  ON class_sessions(original_session_id)
  WHERE original_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_class_status
  ON enrollments(class_id, status);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_daily
  ON teacher_session_attendance(session_id, status);
