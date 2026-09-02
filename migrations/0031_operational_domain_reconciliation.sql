-- ====================================================================
-- Migration 0031: operational-domain reconciliation
--
-- Forward-only repair migration. Keeps previously published migration
-- numbers intact and applies the canonical operational integrity rules.
-- ====================================================================

PRAGMA foreign_keys=OFF;

-- Teacher attendance: pending is distinct from a recorded absence.
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

-- Makeup ClassSession must reference an existing session in the same class.
CREATE TRIGGER IF NOT EXISTS trg_class_sessions_makeup_insert
BEFORE INSERT ON class_sessions
WHEN NEW.type = 'makeup'
BEGIN
  SELECT CASE
    WHEN NEW.original_session_id IS NULL THEN RAISE(ABORT, 'MAKEUP_REQUIRES_ORIGINAL_SESSION')
    WHEN NOT EXISTS (
      SELECT 1 FROM class_sessions original
      WHERE original.id = NEW.original_session_id
        AND original.class_id = NEW.class_id
    ) THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_SESSION_INVALID')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_class_sessions_makeup_update
BEFORE UPDATE OF type, original_session_id, class_id ON class_sessions
WHEN NEW.type = 'makeup'
BEGIN
  SELECT CASE
    WHEN NEW.original_session_id IS NULL THEN RAISE(ABORT, 'MAKEUP_REQUIRES_ORIGINAL_SESSION')
    WHEN NEW.original_session_id = NEW.id THEN RAISE(ABORT, 'MAKEUP_CANNOT_REFERENCE_SELF')
    WHEN NOT EXISTS (
      SELECT 1 FROM class_sessions original
      WHERE original.id = NEW.original_session_id
        AND original.class_id = NEW.class_id
    ) THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_SESSION_INVALID')
  END;
END;

-- Attendance cannot be recorded on cancelled sessions, and enrollment/class
-- and enrollment/term relationships must remain internally consistent.
CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_validate_insert
BEFORE INSERT ON enrollment_sessions
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.status = 'cancelled'
    ) THEN RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
    WHEN NOT EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN class_sessions cs ON cs.id = NEW.session_id
      WHERE e.id = NEW.enrollment_id
        AND e.class_id = cs.class_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_SESSION_CLASS_MISMATCH')
    WHEN NEW.enrollment_term_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM enrollment_terms et
      WHERE et.id = NEW.enrollment_term_id
        AND et.enrollment_id = NEW.enrollment_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_TERM_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_validate_update
BEFORE UPDATE OF enrollment_id, session_id, enrollment_term_id, status ON enrollment_sessions
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.status = 'cancelled'
    ) AND NEW.status <> 'pending' THEN RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
    WHEN NOT EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN class_sessions cs ON cs.id = NEW.session_id
      WHERE e.id = NEW.enrollment_id
        AND e.class_id = cs.class_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_SESSION_CLASS_MISMATCH')
    WHEN NEW.enrollment_term_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM enrollment_terms et
      WHERE et.id = NEW.enrollment_term_id
        AND et.enrollment_id = NEW.enrollment_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_TERM_MISMATCH')
  END;
END;

-- Student makeup rows must reference an occurrence belonging to the same enrollment.
CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_makeup_insert
BEFORE INSERT ON enrollment_sessions
WHEN NEW.makeup_for_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM enrollment_sessions original
    WHERE original.id = NEW.makeup_for_id
      AND original.enrollment_id = NEW.enrollment_id
  ) THEN RAISE(ABORT, 'MAKEUP_ENROLLMENT_MISMATCH') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_makeup_update
BEFORE UPDATE OF makeup_for_id, enrollment_id ON enrollment_sessions
WHEN NEW.makeup_for_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.makeup_for_id = NEW.id THEN RAISE(ABORT, 'MAKEUP_CANNOT_REFERENCE_SELF')
    WHEN NOT EXISTS (
      SELECT 1 FROM enrollment_sessions original
      WHERE original.id = NEW.makeup_for_id
        AND original.enrollment_id = NEW.enrollment_id
    ) THEN RAISE(ABORT, 'MAKEUP_ENROLLMENT_MISMATCH')
  END;
END;

-- Teacher attendance must match the instructor assigned to the concrete session.
CREATE TRIGGER IF NOT EXISTS trg_teacher_attendance_validate_insert
BEFORE INSERT ON teacher_session_attendance
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM class_sessions cs
    WHERE cs.id = NEW.session_id
      AND cs.instructor_id = NEW.instructor_id
  ) THEN RAISE(ABORT, 'SESSION_INSTRUCTOR_MISMATCH') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_teacher_attendance_validate_update
BEFORE UPDATE OF session_id, instructor_id ON teacher_session_attendance
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM class_sessions cs
    WHERE cs.id = NEW.session_id
      AND cs.instructor_id = NEW.instructor_id
  ) THEN RAISE(ABORT, 'SESSION_INSTRUCTOR_MISMATCH') END;
END;
