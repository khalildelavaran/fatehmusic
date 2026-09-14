-- ====================================================================
-- Migration 0041: restore the complete TEST school dataset
--
-- Repair migration for the dataset intentionally deactivated by 0040.
-- Reconciles existing TEST rows first, then inserts only genuinely
-- missing relationships. Scoped exclusively to deterministic TEST data.
-- ====================================================================

-- 1. Restore all synthetic TEST students.
UPDATE students
SET status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE national_code LIKE '99%'
  AND notes LIKE '%TEST DATA%';

-- 2. Restore dedicated TEST classes and schedules.
UPDATE classes
SET status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE title LIKE 'تست — دوره %'
  AND notes LIKE '%TEST DATA%';

UPDATE class_schedules
SET status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id FROM classes
  WHERE title LIKE 'تست — دوره %' AND notes LIKE '%TEST DATA%'
);

-- 3. Restore legacy memberships.
UPDATE class_students
SET status = 'active'
WHERE class_id IN (
  SELECT id FROM classes
  WHERE title LIKE 'تست — دوره %' AND notes LIKE '%TEST DATA%'
)
AND student_id IN (
  SELECT id FROM students
  WHERE national_code LIKE '99%' AND notes LIKE '%TEST DATA%'
);

INSERT INTO class_students (class_id, student_id, enrollment_date, status)
SELECT c.id, s.id, '2026-09-01', 'active'
FROM classes c
JOIN students s
  ON s.national_code LIKE '99%'
 AND s.notes LIKE '%TEST DATA%'
 AND ((CAST(substr(s.national_code, 3, 8) AS INTEGER) - 1) / 10) + 1 = c.course_id
WHERE c.title LIKE 'تست — دوره %'
  AND c.notes LIKE '%TEST DATA%'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM class_students cs
    WHERE cs.class_id = c.id AND cs.student_id = s.id
  );

-- 4. Reconcile normalized enrollments without violating the partial
-- unique index. Existing rows are activated; only absent pairs insert.
UPDATE enrollments
SET status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id FROM classes
  WHERE title LIKE 'تست — %' AND notes LIKE '%TEST DATA%'
)
AND student_id IN (
  SELECT id FROM students
  WHERE national_code LIKE '99%' AND notes LIKE '%TEST DATA%'
);

INSERT INTO enrollments (
  class_id, student_id, enrolled_at, status, source_class_student_id
)
SELECT c.id, s.id, '2026-09-01', 'active', cs.id
FROM classes c
JOIN students s
  ON s.national_code LIKE '99%'
 AND s.notes LIKE '%TEST DATA%'
 AND ((CAST(substr(s.national_code, 3, 8) AS INTEGER) - 1) / 10) + 1 = c.course_id
JOIN class_students cs
  ON cs.class_id = c.id AND cs.student_id = s.id AND cs.status = 'active'
WHERE c.title LIKE 'تست — %'
  AND c.notes LIKE '%TEST DATA%'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM enrollments existing
    WHERE existing.class_id = c.id AND existing.student_id = s.id
  );

-- 5. Restore/ensure one active term per TEST enrollment.
UPDATE enrollment_terms
SET status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE term_number = 1
  AND enrollment_id IN (
    SELECT e.id
    FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    JOIN students s ON s.id = e.student_id
    WHERE c.title LIKE 'تست — %'
      AND c.notes LIKE '%TEST DATA%'
      AND s.national_code LIKE '99%'
      AND s.notes LIKE '%TEST DATA%'
  );

INSERT INTO enrollment_terms (
  enrollment_id, term_number, start_date, planned_sessions,
  billing_type, tuition_amount, status
)
SELECT e.id, 1, '2026-09-01', 16, 'session_based', 0, 'active'
FROM enrollments e
JOIN classes c ON c.id = e.class_id
JOIN students s ON s.id = e.student_id
WHERE c.title LIKE 'تست — %'
  AND c.notes LIKE '%TEST DATA%'
  AND s.national_code LIKE '99%'
  AND s.notes LIKE '%TEST DATA%'
  AND e.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_terms et
    WHERE et.enrollment_id = e.id AND et.term_number = 1
  );

-- 6. Restore missing enrollment_session rows for every non-cancelled
-- TEST session. Existing attendance states remain untouched.
INSERT INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status,
  attendance_mode, note
)
SELECT
  e.id,
  cs.id,
  (SELECT et.id FROM enrollment_terms et
   WHERE et.enrollment_id = e.id AND et.status = 'active'
   ORDER BY et.term_number DESC LIMIT 1),
  'pending',
  CASE WHEN cs.location_type = 'online' THEN 'online' ELSE 'in_person' END,
  'TEST DATA — restored attendance row'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN enrollments e ON e.class_id = cs.class_id AND e.status = 'active'
JOIN students s ON s.id = e.student_id
WHERE c.title LIKE 'تست — %'
  AND c.notes LIKE '%TEST DATA%'
  AND s.national_code LIKE '99%'
  AND s.notes LIKE '%TEST DATA%'
  AND cs.status <> 'cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_sessions existing
    WHERE existing.enrollment_id = e.id AND existing.session_id = cs.id
  );

-- 7. Restore TEST future/current regular sessions that 0040 cancelled.
-- Historical completed/cancelled records are preserved.
UPDATE class_sessions
SET status = 'scheduled',
    notes = CASE
      WHEN notes LIKE '%غیرفعال‌شده به‌صورت خودکار: کلاس تستی%' THEN
        replace(notes, ' | غیرفعال‌شده به‌صورت خودکار: کلاس تستی', '')
      ELSE notes
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id FROM classes
  WHERE title LIKE 'تست — %' AND notes LIKE '%TEST DATA%'
)
AND session_date >= '2026-09-14'
AND status = 'cancelled'
AND type = 'regular';

INSERT INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status,
  attendance_mode, note
)
SELECT
  e.id,
  cs.id,
  (SELECT et.id FROM enrollment_terms et
   WHERE et.enrollment_id = e.id AND et.status = 'active'
   ORDER BY et.term_number DESC LIMIT 1),
  'pending',
  CASE WHEN cs.location_type = 'online' THEN 'online' ELSE 'in_person' END,
  'TEST DATA — restored current/future attendance row'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN enrollments e ON e.class_id = cs.class_id AND e.status = 'active'
JOIN students s ON s.id = e.student_id
WHERE c.title LIKE 'تست — %'
  AND c.notes LIKE '%TEST DATA%'
  AND s.national_code LIKE '99%'
  AND s.notes LIKE '%TEST DATA%'
  AND cs.status = 'scheduled'
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_sessions existing
    WHERE existing.enrollment_id = e.id AND existing.session_id = cs.id
  );

-- 8. Restore missing teacher attendance rows only.
INSERT INTO teacher_session_attendance (
  session_id, instructor_id, status, note
)
SELECT
  cs.id,
  cs.instructor_id,
  CASE WHEN cs.id % 5 = 0 THEN 'absent' ELSE 'present' END,
  'TEST DATA — restored teacher attendance'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE c.title LIKE 'تست — %'
  AND c.notes LIKE '%TEST DATA%'
  AND cs.status <> 'cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM teacher_session_attendance existing
    WHERE existing.session_id = cs.id
      AND existing.instructor_id = cs.instructor_id
  );
