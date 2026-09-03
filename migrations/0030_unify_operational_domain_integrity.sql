-- Unified operational-domain integrity rules.
-- Attendance is never allowed against a cancelled concrete session.
-- Makeup sessions must point to an original session in the same class.
-- Student makeup rows remain tied to the original enrollment/term.
-- An excused original occurrence cannot be changed after its makeup exists.
-- Canonical teacher identity column is instructor_id.

PRAGMA foreign_keys=OFF;

-- Teacher attendance must distinguish "not recorded" from a real absence
-- while preserving the schema introduced by 0022.
CREATE TABLE teacher_session_attendance_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  instructor_id INTEGER NOT NULL REFERENCES instructors(id),
  status TEXT NOT NULL DEFAULT 'pending',
  check_in_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, instructor_id),
  CHECK (status IN ('pending', 'present', 'absent'))
);

INSERT INTO teacher_session_attendance_v2
  (id, session_id, instructor_id, status, check_in_at, note, created_at, updated_at)
SELECT
  id, session_id, instructor_id,
  CASE WHEN status IN ('present','absent') THEN status ELSE 'pending' END,
  check_in_at, note, created_at, updated_at
FROM teacher_session_attendance;

DROP TABLE teacher_session_attendance;
ALTER TABLE teacher_session_attendance_v2 RENAME TO teacher_session_attendance;

CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_session
  ON teacher_session_attendance(session_id, instructor_id);
CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_instructor
  ON teacher_session_attendance(instructor_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_date
  ON class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date
  ON class_sessions(class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_session
  ON enrollment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_enrollment_term_status
  ON enrollment_sessions(enrollment_id, enrollment_term_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_sessions_one_makeup_per_original
  ON enrollment_sessions(enrollment_id, makeup_for_id)
  WHERE makeup_for_id IS NOT NULL;

PRAGMA foreign_keys=ON;

CREATE TRIGGER IF NOT EXISTS trg_class_sessions_makeup_insert
BEFORE INSERT ON class_sessions
WHEN NEW.type = 'makeup'
BEGIN
  SELECT CASE
    WHEN NEW.original_session_id IS NULL THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_SESSION_REQUIRED')
    WHEN NOT EXISTS (
      SELECT 1 FROM class_sessions original
      WHERE original.id = NEW.original_session_id
        AND original.class_id = NEW.class_id
    ) THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_CLASS_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_class_sessions_makeup_update
BEFORE UPDATE OF type, original_session_id, class_id ON class_sessions
WHEN NEW.type = 'makeup'
BEGIN
  SELECT CASE
    WHEN NEW.original_session_id IS NULL THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_SESSION_REQUIRED')
    WHEN NOT EXISTS (
      SELECT 1 FROM class_sessions original
      WHERE original.id = NEW.original_session_id
        AND original.class_id = NEW.class_id
    ) THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_CLASS_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_session_insert_validate
BEFORE INSERT ON enrollment_sessions
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM enrollments e
      JOIN class_sessions cs ON cs.class_id = e.class_id
      WHERE e.id = NEW.enrollment_id AND cs.id = NEW.session_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_SESSION_CLASS_MISMATCH')
    WHEN NEW.enrollment_term_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM enrollment_terms et
      WHERE et.id = NEW.enrollment_term_id AND et.enrollment_id = NEW.enrollment_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_TERM_MISMATCH')
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.status = 'cancelled'
    ) THEN RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_session_update_validate
BEFORE UPDATE OF enrollment_id, session_id, enrollment_term_id, makeup_for_id, status ON enrollment_sessions
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM enrollments e
      JOIN class_sessions cs ON cs.class_id = e.class_id
      WHERE e.id = NEW.enrollment_id AND cs.id = NEW.session_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_SESSION_CLASS_MISMATCH')
    WHEN NEW.enrollment_term_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM enrollment_terms et
      WHERE et.id = NEW.enrollment_term_id AND et.enrollment_id = NEW.enrollment_id
    ) THEN RAISE(ABORT, 'ENROLLMENT_TERM_MISMATCH')
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.status = 'cancelled'
    ) THEN RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_session_makeup_insert_validate
BEFORE INSERT ON enrollment_sessions
WHEN NEW.makeup_for_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM enrollment_sessions original
      WHERE original.id = NEW.makeup_for_id
        AND original.enrollment_id = NEW.enrollment_id
        AND original.status = 'excused'
        AND (NEW.enrollment_term_id IS original.enrollment_term_id)
    ) THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_ENROLLMENT_MISMATCH')
    WHEN NOT EXISTS (
      SELECT 1
      FROM enrollment_sessions original
      JOIN class_sessions original_session ON original_session.id = original.session_id
      JOIN class_sessions makeup_session ON makeup_session.id = NEW.session_id
      WHERE original.id = NEW.makeup_for_id
        AND makeup_session.type = 'makeup'
        AND makeup_session.original_session_id = original.session_id
        AND makeup_session.class_id = original_session.class_id
    ) THEN RAISE(ABORT, 'MAKEUP_SESSION_LINK_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_session_makeup_update_validate
BEFORE UPDATE OF enrollment_id, session_id, enrollment_term_id, makeup_for_id ON enrollment_sessions
WHEN NEW.makeup_for_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM enrollment_sessions original
      WHERE original.id = NEW.makeup_for_id
        AND original.enrollment_id = NEW.enrollment_id
        AND original.status = 'excused'
        AND (NEW.enrollment_term_id IS original.enrollment_term_id)
    ) THEN RAISE(ABORT, 'MAKEUP_ORIGINAL_ENROLLMENT_MISMATCH')
    WHEN NOT EXISTS (
      SELECT 1
      FROM enrollment_sessions original
      JOIN class_sessions original_session ON original_session.id = original.session_id
      JOIN class_sessions makeup_session ON makeup_session.id = NEW.session_id
      WHERE original.id = NEW.makeup_for_id
        AND makeup_session.type = 'makeup'
        AND makeup_session.original_session_id = original.session_id
        AND makeup_session.class_id = original_session.class_id
    ) THEN RAISE(ABORT, 'MAKEUP_SESSION_LINK_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_session_original_makeup_lock
BEFORE UPDATE OF status ON enrollment_sessions
WHEN OLD.status = 'excused'
  AND NEW.status <> 'excused'
  AND EXISTS (
    SELECT 1 FROM enrollment_sessions makeup
    WHERE makeup.makeup_for_id = OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'EXCUSED_SESSION_HAS_MAKEUP');
END;

CREATE TRIGGER IF NOT EXISTS trg_teacher_session_attendance_validate
BEFORE INSERT ON teacher_session_attendance
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.status = 'cancelled'
    ) THEN RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
    WHEN NOT EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.instructor_id = NEW.instructor_id
    ) THEN RAISE(ABORT, 'TEACHER_SESSION_INSTRUCTOR_MISMATCH')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_teacher_session_attendance_update_validate
BEFORE UPDATE OF session_id, instructor_id, status ON teacher_session_attendance
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.status = 'cancelled'
    ) THEN RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
    WHEN NOT EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = NEW.session_id AND cs.instructor_id = NEW.instructor_id
    ) THEN RAISE(ABORT, 'TEACHER_SESSION_INSTRUCTOR_MISMATCH')
  END;
END;
