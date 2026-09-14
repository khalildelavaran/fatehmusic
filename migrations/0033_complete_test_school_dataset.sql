-- ====================================================================
-- Migration 0033: complete operational test-school dataset
--
-- Goal: make the test database useful for end-to-end admin/daily-planner
-- testing, not just for a single weekday.
--
-- Guarantees:
--   * all 23 canonical courses have active test classes
--   * every active instructor has at least one test class
--   * every test class has an active schedule on all 7 weekdays
--   * the existing 230 TEST students remain enrolled in their course class
--   * every test session has enrollment_session rows for its students
--   * concrete sessions exist for every calendar day from 2026-09-14
--     through 2026-12-31
--   * test rooms and teacher attendance rows are also populated
--
-- Everything is deterministic/idempotent and marked TEST DATA.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Test rooms
-- --------------------------------------------------------------------
WITH RECURSIVE room_slots(slot) AS (
  SELECT 1
  UNION ALL
  SELECT slot + 1 FROM room_slots WHERE slot < 8
)
INSERT INTO rooms (name, capacity, status, notes)
SELECT
  printf('تست اتاق %02d', slot),
  2,
  'active',
  'TEST DATA — operational planner room'
FROM room_slots
WHERE NOT EXISTS (
  SELECT 1 FROM rooms r WHERE r.name = printf('تست اتاق %02d', slot)
);

-- --------------------------------------------------------------------
-- 2. Ensure every active instructor is represented by a test class.
--    Existing migration 0032 already created one class per course.
--    These extra classes cover instructors that were not selected by
--    the course override fallback.
-- --------------------------------------------------------------------
WITH instructor_pool AS (
  SELECT
    i.id,
    ROW_NUMBER() OVER (ORDER BY i.id) AS rn
  FROM instructors i
  WHERE i.is_active = 1
    AND NOT EXISTS (
      SELECT 1
      FROM classes c
      WHERE c.title LIKE 'تست — %'
        AND c.instructor_id = i.id
    )
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
  printf('تست — پوشش استاد %02d', p.rn),
  ((p.rn - 1) % 23) + 1,
  p.id,
  '',
  'group',
  10,
  'تستی',
  '2026-09-01',
  '2026-12-31',
  'active',
  'TEST DATA — instructor coverage class',
  'in_person'
FROM instructor_pool p
WHERE NOT EXISTS (
  SELECT 1
  FROM classes c
  WHERE c.title = printf('تست — پوشش استاد %02d', p.rn)
);

-- --------------------------------------------------------------------
-- 3. Give every test class a room and make the assignment visible in
--    the normalized class/session model.
-- --------------------------------------------------------------------
UPDATE classes
SET default_room_id = (
  SELECT r.id
  FROM rooms r
  WHERE r.name = printf(
    'تست اتاق %02d',
    ((classes.id - 1) % 8) + 1
  )
)
WHERE title LIKE 'تست — %'
  AND status = 'active';

-- --------------------------------------------------------------------
-- 4. Every test class meets on EVERY weekday.
--    0..6 follows SQLite's weekday convention (Sunday..Saturday).
-- --------------------------------------------------------------------
WITH RECURSIVE weekdays(day_of_week) AS (
  SELECT 0
  UNION ALL
  SELECT day_of_week + 1 FROM weekdays WHERE day_of_week < 6
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
  w.day_of_week,
  printf(
    '%02d:%02d',
    16 + ((c.id + w.day_of_week) % 5),
    ((c.id + w.day_of_week) % 2) * 30
  ),
  printf(
    '%02d:%02d',
    17 + ((c.id + w.day_of_week) % 5),
    ((c.id + w.day_of_week) % 2) * 30
  ),
  c.default_room_id,
  '2026-09-01',
  '2026-12-31',
  'active'
FROM classes c
CROSS JOIN weekdays w
WHERE c.title LIKE 'تست — %'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM class_schedules cs
    WHERE cs.class_id = c.id
      AND cs.day_of_week = w.day_of_week
      AND cs.status = 'active'
  );

-- --------------------------------------------------------------------
-- 5. Legacy memberships for instructor-coverage classes.
--    Use the same deterministic TEST students belonging to the class's
--    canonical course so every teacher test class has real enrollments.
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
 AND ((CAST(substr(s.national_code, 3, 8) AS INTEGER) - 1) / 10) + 1 = c.course_id
WHERE c.title LIKE 'تست — پوشش استاد %'
  AND s.status = 'active';

-- --------------------------------------------------------------------
-- 6. Normalized enrollments for every TEST student in every test class.
-- --------------------------------------------------------------------
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
 AND ((CAST(substr(s.national_code, 3, 8) AS INTEGER) - 1) / 10) + 1 = c.course_id
JOIN class_students cs
  ON cs.class_id = c.id
 AND cs.student_id = s.id
WHERE c.title LIKE 'تست — %'
  AND s.status = 'active';

-- --------------------------------------------------------------------
-- 7. One active term for every TEST enrollment that does not already
--    have one. Keep the original 0032 term intact.
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
  16,
  'session_based',
  0,
  'active'
FROM enrollments e
JOIN classes c ON c.id = e.class_id
JOIN students s ON s.id = e.student_id
WHERE c.title LIKE 'تست — %'
  AND s.national_code LIKE '99%'
  AND NOT EXISTS (
    SELECT 1
    FROM enrollment_terms et
    WHERE et.enrollment_id = e.id
      AND et.term_number = 1
  );

-- --------------------------------------------------------------------
-- 8. Concrete sessions for EVERY day in the test period.
--    ClassSession is the operational source of truth used by the daily
--    dashboard; schedules alone are not sufficient for daily testing.
-- --------------------------------------------------------------------
WITH RECURSIVE dates(session_date) AS (
  SELECT '2026-09-14'
  UNION ALL
  SELECT date(session_date, '+1 day')
  FROM dates
  WHERE session_date < '2026-12-31'
)
INSERT INTO class_sessions (
  class_id,
  session_date,
  start_time,
  end_time,
  instructor_id,
  room_id,
  location_type,
  type,
  status,
  notes
)
SELECT
  c.id,
  d.session_date,
  cs.start_time,
  cs.end_time,
  c.instructor_id,
  cs.room_id,
  'in_person',
  'regular',
  'scheduled',
  'TEST DATA — daily planner session'
FROM classes c
JOIN dates d
JOIN class_schedules cs
  ON cs.class_id = c.id
 AND cs.day_of_week = CAST(strftime('%w', d.session_date) AS INTEGER)
 AND cs.status = 'active'
WHERE c.title LIKE 'تست — %'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM class_sessions existing
    WHERE existing.class_id = c.id
      AND existing.session_date = d.session_date
      AND existing.start_time = cs.start_time
      AND existing.end_time = cs.end_time
  );

-- --------------------------------------------------------------------
-- 9. Enrollment-session records for every concrete TEST session.
--    Start as pending so attendance can be tested from a clean state.
-- --------------------------------------------------------------------
INSERT OR IGNORE INTO enrollment_sessions (
  enrollment_id,
  session_id,
  enrollment_term_id,
  status,
  attendance_mode,
  note
)
SELECT
  e.id,
  s.id,
  et.id,
  'pending',
  'in_person',
  'TEST DATA — attendance not yet recorded'
FROM class_sessions s
JOIN enrollments e ON e.class_id = s.class_id AND e.status = 'active'
LEFT JOIN enrollment_terms et
  ON et.enrollment_id = e.id
 AND et.status = 'active'
 AND et.term_number = 1
JOIN classes c ON c.id = s.class_id
WHERE c.title LIKE 'تست — %'
  AND c.status = 'active';

-- --------------------------------------------------------------------
-- 10. Teacher attendance rows also start pending.
-- --------------------------------------------------------------------
INSERT OR IGNORE INTO teacher_session_attendance (
  session_id,
  instructor_id,
  status,
  note
)
SELECT
  s.id,
  s.instructor_id,
  'pending',
  'TEST DATA — teacher attendance not yet recorded'
FROM class_sessions s
JOIN classes c ON c.id = s.class_id
WHERE c.title LIKE 'تست — %';

-- --------------------------------------------------------------------
-- 11. Helpful indexes for the enlarged deterministic test dataset.
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_test_students_national_code
  ON students(national_code);
CREATE INDEX IF NOT EXISTS idx_test_classes_title
  ON classes(title);
