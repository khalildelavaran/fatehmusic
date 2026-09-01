-- Attendance is one current status per student enrollment occurrence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_enrollment_session
  ON enrollment_sessions(id);

-- Cancelled sessions must not receive attendance in application logic.
-- SQLite/D1 cannot express this cross-table invariant with a simple CHECK,
-- so the service layer is authoritative for the rule.
