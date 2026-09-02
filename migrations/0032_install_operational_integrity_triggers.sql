-- ====================================================================
-- Migration 0032: operational integrity triggers
--
-- Trigger definitions are isolated from migration 0030 because D1 remote
-- migrations use a trigger-aware statement splitter that has had parser
-- compatibility problems with larger mixed DDL migrations.
-- ====================================================================

CREATE TRIGGER IF NOT EXISTS trg_class_sessions_makeup_insert
BEFORE INSERT ON class_sessions
WHEN NEW.type = 'makeup'
BEGIN
  SELECT RAISE(ABORT, 'MAKEUP_REQUIRES_ORIGINAL_SESSION')
  WHERE NEW.original_session_id IS NULL;
  SELECT RAISE(ABORT, 'MAKEUP_ORIGINAL_SESSION_INVALID')
  WHERE NOT EXISTS (
    SELECT 1
    FROM class_sessions original
    WHERE original.id = NEW.original_session_id
      AND original.class_id = NEW.class_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_class_sessions_makeup_update
BEFORE UPDATE OF type, original_session_id, class_id ON class_sessions
WHEN NEW.type = 'makeup'
BEGIN
  SELECT RAISE(ABORT, 'MAKEUP_REQUIRES_ORIGINAL_SESSION')
  WHERE NEW.original_session_id IS NULL;
  SELECT RAISE(ABORT, 'MAKEUP_CANNOT_REFERENCE_SELF')
  WHERE NEW.original_session_id = NEW.id;
  SELECT RAISE(ABORT, 'MAKEUP_ORIGINAL_SESSION_INVALID')
  WHERE NOT EXISTS (
    SELECT 1
    FROM class_sessions original
    WHERE original.id = NEW.original_session_id
      AND original.class_id = NEW.class_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_validate_insert
BEFORE INSERT ON enrollment_sessions
BEGIN
  SELECT RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
  WHERE EXISTS (
    SELECT 1
    FROM class_sessions cs
    WHERE cs.id = NEW.session_id
      AND cs.status = 'cancelled'
  );
  SELECT RAISE(ABORT, 'ENROLLMENT_SESSION_CLASS_MISMATCH')
  WHERE NOT EXISTS (
    SELECT 1
    FROM enrollments e
    JOIN class_sessions cs ON cs.id = NEW.session_id
    WHERE e.id = NEW.enrollment_id
      AND e.class_id = cs.class_id
  );
  SELECT RAISE(ABORT, 'ENROLLMENT_TERM_MISMATCH')
  WHERE NEW.enrollment_term_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM enrollment_terms et
      WHERE et.id = NEW.enrollment_term_id
        AND et.enrollment_id = NEW.enrollment_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_validate_update
BEFORE UPDATE OF enrollment_id, session_id, enrollment_term_id, status ON enrollment_sessions
BEGIN
  SELECT RAISE(ABORT, 'ATTENDANCE_ON_CANCELLED_SESSION')
  WHERE EXISTS (
    SELECT 1
    FROM class_sessions cs
    WHERE cs.id = NEW.session_id
      AND cs.status = 'cancelled'
  )
    AND NEW.status <> 'pending';
  SELECT RAISE(ABORT, 'ENROLLMENT_SESSION_CLASS_MISMATCH')
  WHERE NOT EXISTS (
    SELECT 1
    FROM enrollments e
    JOIN class_sessions cs ON cs.id = NEW.session_id
    WHERE e.id = NEW.enrollment_id
      AND e.class_id = cs.class_id
  );
  SELECT RAISE(ABORT, 'ENROLLMENT_TERM_MISMATCH')
  WHERE NEW.enrollment_term_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM enrollment_terms et
      WHERE et.id = NEW.enrollment_term_id
        AND et.enrollment_id = NEW.enrollment_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_makeup_insert
BEFORE INSERT ON enrollment_sessions
WHEN NEW.makeup_for_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'MAKEUP_ENROLLMENT_MISMATCH')
  WHERE NOT EXISTS (
    SELECT 1
    FROM enrollment_sessions original
    WHERE original.id = NEW.makeup_for_id
      AND original.enrollment_id = NEW.enrollment_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_sessions_makeup_update
BEFORE UPDATE OF makeup_for_id, enrollment_id ON enrollment_sessions
WHEN NEW.makeup_for_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'MAKEUP_CANNOT_REFERENCE_SELF')
  WHERE NEW.makeup_for_id = NEW.id;
  SELECT RAISE(ABORT, 'MAKEUP_ENROLLMENT_MISMATCH')
  WHERE NOT EXISTS (
    SELECT 1
    FROM enrollment_sessions original
    WHERE original.id = NEW.makeup_for_id
      AND original.enrollment_id = NEW.enrollment_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_teacher_attendance_validate_insert
BEFORE INSERT ON teacher_session_attendance
BEGIN
  SELECT RAISE(ABORT, 'SESSION_INSTRUCTOR_MISMATCH')
  WHERE NOT EXISTS (
    SELECT 1
    FROM class_sessions cs
    WHERE cs.id = NEW.session_id
      AND cs.instructor_id = NEW.instructor_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_teacher_attendance_validate_update
BEFORE UPDATE OF session_id, instructor_id ON teacher_session_attendance
BEGIN
  SELECT RAISE(ABORT, 'SESSION_INSTRUCTOR_MISMATCH')
  WHERE NOT EXISTS (
    SELECT 1
    FROM class_sessions cs
    WHERE cs.id = NEW.session_id
      AND cs.instructor_id = NEW.instructor_id
  );
END;
