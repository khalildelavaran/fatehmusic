-- ====================================================================
-- Migration 0030: unified operational education integrity
--
-- Canonical vocabulary used by application code:
--   class_sessions.instructor_id
--   enrollment_sessions.status
--   enrollment_sessions.makeup_for_id
--   teacher_session_attendance.instructor_id
--
-- Schedule is a recurring plan. ClassSession is the operational truth.
-- Calendar exceptions are advisory and never cancel a session implicitly.
--
-- Trigger definitions are intentionally isolated in migration 0032 because
-- D1 remote migrations have a fragile trigger-aware statement parser.
-- ====================================================================

PRAGMA foreign_keys=OFF;

-- Teacher attendance must distinguish "not recorded" from a real absence.
CREATE TABLE teacher_session_attendance_v2 (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  instructor_id  INTEGER NOT NULL REFERENCES instructors(id),
  status         TEXT NOT NULL DEFAULT 'pending',
  check_in_at    TEXT,
  note           TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('pending', 'present', 'absent')),
  UNIQUE (session_id, instructor_id)
);

INSERT INTO teacher_session_attendance_v2
  (id, session_id, instructor_id, status, check_in_at, note, created_at, updated_at)
SELECT id, session_id, instructor_id, status, check_in_at, note, created_at, updated_at
FROM teacher_session_attendance;

DROP TABLE teacher_session_attendance;
ALTER TABLE teacher_session_attendance_v2 RENAME TO teacher_session_attendance;

PRAGMA foreign_keys=ON;

CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_status
  ON teacher_session_attendance(session_id, status);
CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_instructor
  ON teacher_session_attendance(instructor_id, status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_daily
  ON class_sessions(session_date, start_time, status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_status_date
  ON class_sessions(class_id, status, session_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_status
  ON enrollments(class_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term_status
  ON enrollment_sessions(enrollment_term_id, status);
