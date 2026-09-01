-- Term policy belongs to the class, while the concrete term belongs to the student's enrollment.
-- This supports 4/8/10-session classes and monthly billing without hard-coding
-- instrument-specific rules into EnrollmentTerm.
CREATE TABLE IF NOT EXISTS class_term_policies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  billing_type    TEXT NOT NULL DEFAULT 'session_based',
  planned_sessions INTEGER,
  tuition_amount  INTEGER,
  due_days        INTEGER,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (billing_type IN ('session_based', 'monthly')),
  CHECK (planned_sessions IS NULL OR planned_sessions IN (4, 8, 10) OR planned_sessions > 0),
  CHECK (tuition_amount IS NULL OR tuition_amount >= 0),
  CHECK (due_days IS NULL OR due_days >= 0),
  CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_term_policies_active
  ON class_term_policies(class_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_class_term_policies_class
  ON class_term_policies(class_id, status);

-- Teacher attendance also starts unresolved. This makes the daily dashboard
-- able to distinguish "not registered" from an explicit absence.
CREATE TABLE teacher_session_attendance_v2 (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  instructor_id  INTEGER NOT NULL REFERENCES instructors(id),
  status         TEXT NOT NULL DEFAULT 'pending',
  check_in_at    TEXT,
  note           TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('pending', 'present', 'absent'))
);

INSERT INTO teacher_session_attendance_v2
  (id, session_id, instructor_id, status, check_in_at, note, created_at, updated_at)
SELECT id, session_id, instructor_id, status, check_in_at, note, created_at, updated_at
FROM teacher_session_attendance;

DROP TABLE teacher_session_attendance;
ALTER TABLE teacher_session_attendance_v2 RENAME TO teacher_session_attendance;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_session_attendance_unique
  ON teacher_session_attendance(session_id, instructor_id);
CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_status
  ON teacher_session_attendance(session_id, status);
