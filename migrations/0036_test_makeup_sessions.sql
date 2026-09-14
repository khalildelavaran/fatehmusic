-- ====================================================================
-- Migration 0036: TEST makeup-session scenarios
-- ====================================================================
-- Creates a deterministic makeup workflow for excused historical
-- attendance without changing the student's active enrollment.
-- ====================================================================

-- One makeup class-session for a deterministic subset of historical
-- sessions. The original session remains completed and its student
-- attendance remains excused.
INSERT INTO class_sessions (
  class_id, session_date, start_time, end_time, instructor_id, room_id,
  location_type, type, status, original_session_id, notes
)
SELECT
  cs.class_id,
  date(cs.session_date, '+14 day'),
  cs.start_time,
  cs.end_time,
  cs.instructor_id,
  cs.room_id,
  cs.location_type,
  'makeup',
  CASE WHEN date(cs.session_date, '+14 day') < '2026-09-14' THEN 'completed' ELSE 'scheduled' END,
  cs.id,
  'TEST DATA — makeup session for excused attendance'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE c.title LIKE 'تست — %'
  AND cs.type = 'regular'
  AND cs.status = 'completed'
  AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-05'
  AND (cs.id % 13) = 0
  AND EXISTS (
    SELECT 1
    FROM enrollment_sessions es
    WHERE es.session_id = cs.id
      AND es.status = 'excused'
  )
  AND NOT EXISTS (
    SELECT 1 FROM class_sessions m
    WHERE m.original_session_id = cs.id AND m.type = 'makeup'
  );

-- Provision makeup attendance records for the excused students only.
INSERT OR IGNORE INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status,
  attendance_mode, makeup_for_id, note
)
SELECT
  original_es.enrollment_id,
  makeup.id,
  original_es.enrollment_term_id,
  CASE WHEN (original_es.enrollment_id % 3) = 0 THEN 'present' ELSE 'pending' END,
  CASE WHEN makeup.location_type = 'online' THEN 'online' ELSE 'in_person' END,
  original_es.id,
  'TEST DATA — makeup attendance linked to excused session'
FROM class_sessions makeup
JOIN enrollment_sessions original_es
  ON original_es.session_id = makeup.original_session_id
 AND original_es.status = 'excused'
WHERE makeup.type = 'makeup'
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_sessions existing
    WHERE existing.enrollment_id = original_es.enrollment_id
      AND existing.session_id = makeup.id
  );

-- A completed makeup occurrence has actual attendance for the deterministic
-- present cohort; pending records remain available for UI testing.
UPDATE enrollment_sessions
SET note = CASE
  WHEN status = 'present' THEN 'TEST DATA — makeup attended'
  ELSE 'TEST DATA — makeup pending'
END
WHERE makeup_for_id IS NOT NULL
  AND enrollment_id IN (
    SELECT e.id
    FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    JOIN students s ON s.id = e.student_id
    WHERE c.title LIKE 'تست — %' AND s.national_code LIKE '99%'
  );
