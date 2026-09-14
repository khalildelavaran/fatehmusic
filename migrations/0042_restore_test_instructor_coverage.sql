-- ====================================================================
-- Migration 0042: restore TEST instructor coverage classes
--
-- Migration 0041 restored the dedicated TEST course classes and students,
-- but instructor coverage classes created by 0033 also need active
-- memberships/enrollments for the Daily Dashboard and attendance flows.
--
-- TEST DATA ONLY. Safe after partially failed attempts: it creates a new
-- active row only when no active row already exists for the same pair.
-- Existing inactive historical duplicates are preserved.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Restore all TEST instructor coverage classes and their schedules.
-- --------------------------------------------------------------------
UPDATE classes
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE title LIKE 'تست — پوشش استاد %'
  AND notes LIKE '%TEST DATA%';

UPDATE class_schedules
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id
  FROM classes
  WHERE title LIKE 'تست — پوشش استاد %'
    AND notes LIKE '%TEST DATA%'
);

-- --------------------------------------------------------------------
-- 2. Restore ten TEST students per instructor coverage class.
-- Student-to-course mapping is encoded in national_code by migration 0032.
-- --------------------------------------------------------------------
INSERT INTO class_students (class_id, student_id, enrollment_date, status)
SELECT
  c.id,
  s.id,
  '2026-09-01',
  'active'
FROM classes c
JOIN students s
  ON s.national_code LIKE '99%'
 AND s.notes LIKE '%TEST DATA%'
 AND ((CAST(substr(s.national_code, 3, 8) AS INTEGER) - 1) / 10) + 1 = c.course_id
WHERE c.title LIKE 'تست — پوشش استاد %'
  AND c.notes LIKE '%TEST DATA%'
  AND c.status = 'active'
  AND s.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM class_students existing
    WHERE existing.class_id = c.id
      AND existing.student_id = s.id
      AND existing.status = 'active'
  );

-- --------------------------------------------------------------------
-- 3. Create active normalized enrollments for coverage classes.
-- Never reactivate an existing inactive duplicate: insert a fresh active
-- row only when no active enrollment exists for the pair. This cannot
-- violate the one-active partial unique index.
-- --------------------------------------------------------------------
INSERT INTO enrollments (
  class_id, student_id, enrolled_at, status, source_class_student_id
)
SELECT
  c.id,
  s.id,
  '2026-09-01',
  'active',
  cs.id
FROM classes c
JOIN students s
  ON s.national_code LIKE '99%'
 AND s.notes LIKE '%TEST DATA%'
 AND s.status = 'active'
 AND ((CAST(substr(s.national_code, 3, 8) AS INTEGER) - 1) / 10) + 1 = c.course_id
JOIN class_students cs
  ON cs.class_id = c.id
 AND cs.student_id = s.id
 AND cs.status = 'active'
WHERE c.title LIKE 'تست — پوشش استاد %'
  AND c.notes LIKE '%TEST DATA%'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollments existing
    WHERE existing.class_id = c.id
      AND existing.student_id = s.id
      AND existing.status = 'active'
  );

-- --------------------------------------------------------------------
-- 4. Ensure term 1 exists for every active coverage enrollment.
-- --------------------------------------------------------------------
INSERT INTO enrollment_terms (
  enrollment_id, term_number, start_date, planned_sessions,
  billing_type, tuition_amount, status
)
SELECT
  e.id,
  1,
  '2026-09-01',
  16,
  'session_based',
  0,
  'active'
FROM enrollments e
JOIN classes c ON c.id = e.class_id
JOIN students s ON s.id = e.student_id
WHERE c.title LIKE 'تست — پوشش استاد %'
  AND c.notes LIKE '%TEST DATA%'
  AND e.status = 'active'
  AND s.national_code LIKE '99%'
  AND s.notes LIKE '%TEST DATA%'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollment_terms et
    WHERE et.enrollment_id = e.id
      AND et.term_number = 1
  );

-- --------------------------------------------------------------------
-- 5. Restore attendance rows for coverage sessions.
-- Existing rows are preserved.
-- --------------------------------------------------------------------
INSERT INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status,
  attendance_mode, note
)
SELECT
  e.id,
  cs.id,
  (
    SELECT et.id
    FROM enrollment_terms et
    WHERE et.enrollment_id = e.id
      AND et.status = 'active'
    ORDER BY et.term_number DESC, et.id DESC
    LIMIT 1
  ),
  'pending',
  CASE WHEN cs.location_type = 'online' THEN 'online' ELSE 'in_person' END,
  'TEST DATA — restored instructor coverage attendance row'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN enrollments e ON e.class_id = cs.class_id AND e.status = 'active'
JOIN students s ON s.id = e.student_id
WHERE c.title LIKE 'تست — پوشش استاد %'
  AND c.notes LIKE '%TEST DATA%'
  AND s.national_code LIKE '99%'
  AND s.notes LIKE '%TEST DATA%'
  AND cs.status <> 'cancelled'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollment_sessions existing
    WHERE existing.enrollment_id = e.id
      AND existing.session_id = cs.id
  );

-- --------------------------------------------------------------------
-- 6. Restore teacher attendance rows for coverage sessions.
-- --------------------------------------------------------------------
INSERT INTO teacher_session_attendance (
  session_id, instructor_id, status, note
)
SELECT
  cs.id,
  cs.instructor_id,
  CASE WHEN cs.id % 5 = 0 THEN 'absent' ELSE 'present' END,
  'TEST DATA — restored instructor coverage teacher attendance'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE c.title LIKE 'تست — پوشش استاد %'
  AND c.notes LIKE '%TEST DATA%'
  AND cs.status <> 'cancelled'
  AND NOT EXISTS (
    SELECT 1
    FROM teacher_session_attendance existing
    WHERE existing.session_id = cs.id
      AND existing.instructor_id = cs.instructor_id
  );
