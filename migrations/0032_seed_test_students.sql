-- ====================================================================
-- Migration 0032: deterministic test students for every course
--
-- Purpose: populate the operational education model with a realistic,
-- isolated test dataset. Ten synthetic students are created for each
-- course (23 courses => 230 students), each attached to a dedicated
-- test Class, recurring weekly Schedule, Enrollment and Enrollment Term.
--
-- The national codes use the reserved-looking 99xxxxxxxx range and the
-- names are explicitly marked as TEST so they cannot be mistaken for
-- real student records.
--
-- Idempotent: every student, test class and membership has a stable
-- deterministic key. Re-running the migration does not create duplicates.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Test students: 10 per course.
-- --------------------------------------------------------------------
WITH RECURSIVE
  course_ids(course_id) AS (
    SELECT 1
    UNION ALL
    SELECT course_id + 1 FROM course_ids WHERE course_id < 23
  ),
  student_slots(slot) AS (
    SELECT 1
    UNION ALL
    SELECT slot + 1 FROM student_slots WHERE slot < 10
  )
INSERT OR IGNORE INTO students (
  national_code,
  first_name,
  last_name,
  father_name,
  birth_year,
  phone,
  email,
  address,
  occupation,
  notes,
  status
)
SELECT
  printf('99%08d', ((course_id - 1) * 10) + slot),
  'تست',
  printf('هنرجوی دوره %02d-%02d', course_id, slot),
  'تست',
  1385 + ((slot - 1) % 12),
  printf('090000%04d', ((course_id - 1) * 10) + slot),
  printf('test.student.%02d.%02d@fateh.test', course_id, slot),
  'داده تستی',
  'تست سیستم',
  printf('TEST DATA | course=%02d | student=%02d', course_id, slot),
  'active'
FROM course_ids CROSS JOIN student_slots;

-- --------------------------------------------------------------------
-- 2. One dedicated test Class for every course.
--    Course IDs are the canonical IDs from src/data/courses.js.
--    If an administrative course override contains an instructor list,
--    use its first instructor; otherwise fall back to the first D1
--    instructor. This keeps the seed independent from hard-coded names.
-- --------------------------------------------------------------------
WITH RECURSIVE course_ids(course_id) AS (
  SELECT 1
  UNION ALL
  SELECT course_id + 1 FROM course_ids WHERE course_id < 23
)
INSERT INTO classes (
  title,
  course_id,
  instructor_id,
  room,
  class_type,
  capacity,
  level,
  start_date,
  end_date,
  status,
  notes,
  delivery_mode
)
SELECT
  printf('تست — دوره %02d', c.course_id),
  c.course_id,
  COALESCE(
    CAST(json_extract(
      (SELECT co.data FROM course_overrides co WHERE co.id = c.course_id LIMIT 1),
      '$.instructors[0]'
    ) AS INTEGER),
    (SELECT MIN(i.id) FROM instructors i)
  ),
  '',
  'group',
  10,
  'تستی',
  '2026-09-01',
  '2026-12-31',
  'active',
  'TEST DATA — dedicated test class',
  'in_person'
FROM course_ids c
WHERE NOT EXISTS (
  SELECT 1
  FROM classes x
  WHERE x.course_id = c.course_id
    AND x.title = printf('تست — دوره %02d', c.course_id)
);

-- --------------------------------------------------------------------
-- 3. Recurring weekly schedules for the test classes.
--    Stagger the weekday/time deterministically so the daily planner
--    has test data across the week. No room is forced because room IDs
--    are installation-specific.
-- --------------------------------------------------------------------
WITH RECURSIVE course_ids(course_id) AS (
  SELECT 1
  UNION ALL
  SELECT course_id + 1 FROM course_ids WHERE course_id < 23
)
INSERT INTO class_schedules (
  class_id,
  day_of_week,
  start_time,
  end_time,
  room_id,
  effective_from,
  effective_to,
  status
)
SELECT
  c.id,
  (c.course_id - 1) % 7,
  printf('%02d:%02d', 16 + ((c.course_id - 1) % 4), ((c.course_id - 1) % 2) * 30),
  printf('%02d:%02d', 16 + ((c.course_id - 1) % 4) + 1, ((c.course_id - 1) % 2) * 30),
  NULL,
  '2026-09-01',
  '2026-12-31',
  'active'
FROM classes c
WHERE c.title LIKE 'تست — دوره %'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM class_schedules cs
    WHERE cs.class_id = c.id AND cs.status = 'active'
  );

-- --------------------------------------------------------------------
-- 4. Legacy class_students links for compatibility with older admin
--    screens, plus normalized enrollments for the operational model.
-- --------------------------------------------------------------------
INSERT OR IGNORE INTO class_students (
  class_id,
  student_id,
  enrollment_date,
  status
)
SELECT
  c.id,
  s.id,
  '2026-09-01',
  'active'
FROM classes c
JOIN students s
  ON s.national_code LIKE '99%'
 AND CAST(substr(s.national_code, 3, 2) AS INTEGER) = c.course_id
WHERE c.title LIKE 'تست — دوره %';

INSERT OR IGNORE INTO enrollments (
  class_id,
  student_id,
  enrolled_at,
  status,
  source_class_student_id
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
 AND CAST(substr(s.national_code, 3, 2) AS INTEGER) = c.course_id
JOIN class_students cs
  ON cs.class_id = c.id
 AND cs.student_id = s.id
WHERE c.title LIKE 'تست — دوره %';

-- --------------------------------------------------------------------
-- 5. One active 8-session term for each seeded enrollment.
-- --------------------------------------------------------------------
INSERT INTO enrollment_terms (
  enrollment_id,
  term_number,
  start_date,
  planned_sessions,
  billing_type,
  tuition_amount,
  status
)
SELECT
  e.id,
  1,
  '2026-09-01',
  8,
  'session_based',
  0,
  'active'
FROM enrollments e
JOIN classes c ON c.id = e.class_id
JOIN students s ON s.id = e.student_id
WHERE c.title LIKE 'تست — دوره %'
  AND s.national_code LIKE '99%'
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_terms et
    WHERE et.enrollment_id = e.id
      AND et.term_number = 1
  );
