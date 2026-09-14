-- ====================================================================
-- Migration 0041: restore the complete TEST school dataset
--
-- Migration 0040 intentionally deactivated the synthetic dataset created
-- by migrations 0032-0036. The operational test suite requires the full
-- dataset to be active again, including all 230 test students and TEST
-- classes, memberships, enrollments, terms and session rows.
--
-- TEST DATA ONLY. Idempotent and safe to run after a partially failed run.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Restore all 230 synthetic TEST students.
-- --------------------------------------------------------------------
UPDATE students
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE national_code LIKE '99%'
  AND notes LIKE '%TEST DATA%';

-- --------------------------------------------------------------------
-- 2. Restore all dedicated TEST classes from migration 0032.
-- --------------------------------------------------------------------
UPDATE classes
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE title LIKE 'تست — دوره %'
  AND notes LIKE '%TEST DATA%';

-- --------------------------------------------------------------------
-- 3. Restore their schedules.
-- --------------------------------------------------------------------
UPDATE class_schedules
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id
  FROM classes
  WHERE title LIKE 'تست — دوره %'
    AND notes LIKE '%TEST DATA%'
);

-- --------------------------------------------------------------------
-- 4. Restore legacy class memberships.
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
WHERE c.title LIKE 'تست — دوره %'
  AND c.notes LIKE '%TEST DATA%'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM class_students existing
    WHERE existing.class_id = c.id
      AND existing.student_id = s.id
      AND existing.status = 'active'
  );

UPDATE class_students
SET status = 'active'
WHERE class_id IN (
  SELECT id
  FROM classes
  WHERE title LIKE 'تست — دوره %'
    AND notes LIKE '%TEST DATA%'
)
AND student_id IN (
  SELECT id
  FROM students
  WHERE national_code LIKE '99%'
    AND notes LIKE '%TEST DATA%'
);

-- --------------------------------------------------------------------
-- 5. Restore normalized enrollments WITHOUT INSERT OR IGNORE.
-- SQLite's partial unique index on (class_id, student_id) rejects an
-- INSERT OR IGNORE if another unique/trigger path makes the conflict
-- non-ignorable. NOT EXISTS is deterministic and migration-safe here.
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
 AND ((CAST(substr(s.national_code, 3, 8) AS INTEGER) - 1) / 10) + 1 = c.course_id
JOIN class_students cs
  ON cs.class_id = c.id
 AND cs.student_id = s.id
 AND cs.status = 'active'
WHERE c.title LIKE 'تست — %'
  AND c.notes LIKE '%TEST DATA%'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollments existing
    WHERE existing.class_id = c.id
      AND existing.student_id = s.id
);

-- Any existing TEST enrollment is restored to active. This includes
-- rows that may have been present before 0040 deactivated the dataset.
UPDATE enrollments
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id
  FROM classes
  WHERE title LIKE 'تست — %'
    AND notes LIKE '%TEST DATA%'
)
AND student_id IN (
  SELECT id
  FROM students
  WHERE national_code LIKE '99%'
    AND notes LIKE '%TEST DATA%'
);

-- --------------------------------------------------------------------
-- 6. Ensure one active term exists for every restored TEST enrollment.
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
WHERE c.title LIKE 'تست — %'
  AND c.notes LIKE '%TEST DATA%'
  AND s.national_code LIKE '99%'
  AND s.notes LIKE '%TEST DATA%'
  AND e.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollment_terms et
    WHERE et.enrollment_id = e.id
      AND et.term_number = 1
  );

UPDATE enrollment_terms
SET status = 'active',
    updated_at = CURRENT_TIMESTAMP
WHERE enrollment_id IN (
  SELECT e.id
  FROM enrollments e
  JOIN classes c ON c.id = e.class_id
  JOIN students s ON s.id = e.student_id
  WHERE c.title LIKE 'تست — %'
    AND c.notes LIKE '%TEST DATA%'
    AND s.national_code LIKE '99%'
    AND s.notes LIKE '%TEST DATA%'
)
AND term_number = 1;

-- --------------------------------------------------------------------
-- 7. Restore all non-cancelled TEST session rows.
-- Existing attendance statuses are preserved by NOT EXISTS.
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
    ORDER BY et.term_number DESC
    LIMIT 1
  ),
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
    SELECT 1
    FROM enrollment_sessions existing
    WHERE existing.enrollment_id = e.id
      AND existing.session_id = cs.id
  );

-- --------------------------------------------------------------------
-- 8. Restore TEST future/current regular sessions that 0040 cancelled.
-- Historical completed/cancelled records remain untouched.
-- --------------------------------------------------------------------
UPDATE class_sessions
SET status = 'scheduled',
    notes = CASE
      WHEN notes LIKE '%غیرفعال‌شده به‌صورت خودکار: کلاس تستی%' THEN
        replace(notes, ' | غیرفعال‌شده به‌صورت خودکار: کلاس تستی', '')
      ELSE notes
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE class_id IN (
  SELECT id
  FROM classes
  WHERE title LIKE 'تست — %'
    AND notes LIKE '%TEST DATA%'
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
  (
    SELECT et.id
    FROM enrollment_terms et
    WHERE et.enrollment_id = e.id
      AND et.status = 'active'
    ORDER BY et.term_number DESC
    LIMIT 1
  ),
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
    SELECT 1
    FROM enrollment_sessions existing
    WHERE existing.enrollment_id = e.id
      AND existing.session_id = cs.id
  );

-- --------------------------------------------------------------------
-- 9. Restore teacher attendance where absent from the table.
-- --------------------------------------------------------------------
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
    SELECT 1
    FROM teacher_session_attendance existing
    WHERE existing.session_id = cs.id
      AND existing.instructor_id = cs.instructor_id
  );
