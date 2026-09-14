-- ====================================================================
-- Migration 0035: deterministic validation/normalization for TEST data
--
-- 0034 already creates the comprehensive test matrix. This migration is
-- intentionally idempotent and uses correlated subqueries instead of
-- UPDATE ... FROM references to the target table, which are not portable
-- across the remote D1/SQLite execution path.
-- ====================================================================

-- Keep historical sessions present for every active TEST class.
WITH RECURSIVE dates(session_date) AS (
  SELECT '2026-09-01'
  UNION ALL
  SELECT date(session_date, '+1 day') FROM dates WHERE session_date < '2026-09-13'
)
INSERT INTO class_sessions (
  class_id, session_date, start_time, end_time, instructor_id, room_id,
  location_type, type, status, notes
)
SELECT
  c.id,
  d.session_date,
  cs.start_time,
  cs.end_time,
  c.instructor_id,
  cs.room_id,
  CASE WHEN ((c.id + CAST(strftime('%j', d.session_date) AS INTEGER)) % 5) = 0
       THEN 'online' ELSE 'in_person' END,
  'regular',
  CASE WHEN ((c.id + CAST(strftime('%j', d.session_date) AS INTEGER)) % 11) = 0
       THEN 'cancelled' ELSE 'completed' END,
  CASE WHEN ((c.id + CAST(strftime('%j', d.session_date) AS INTEGER)) % 11) = 0
       THEN 'TEST DATA — cancelled historical session'
       ELSE 'TEST DATA — completed historical session' END
FROM classes c
JOIN dates d
JOIN class_schedules cs
  ON cs.class_id = c.id
 AND cs.day_of_week = CAST(strftime('%w', d.session_date) AS INTEGER)
 AND cs.status = 'active'
WHERE c.title LIKE 'تست — %'
  AND c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM class_sessions x
    WHERE x.class_id = c.id
      AND x.session_date = d.session_date
      AND x.start_time = cs.start_time
      AND x.end_time = cs.end_time
  );

-- Never provision attendance records for cancelled sessions.
DELETE FROM enrollment_sessions
WHERE session_id IN (
  SELECT cs.id
  FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id
  WHERE c.title LIKE 'تست — %' AND cs.status = 'cancelled'
);

-- Ensure historical attendance rows exist only for non-cancelled sessions.
INSERT OR IGNORE INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status, attendance_mode, note
)
SELECT
  e.id,
  cs.id,
  (SELECT et.id FROM enrollment_terms et
   WHERE et.enrollment_id = e.id AND et.status = 'active'
   ORDER BY et.term_number DESC LIMIT 1),
  'pending',
  CASE WHEN cs.location_type = 'online' THEN 'online' ELSE 'in_person' END,
  'TEST DATA — validation attendance row'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN enrollments e ON e.class_id = cs.class_id AND e.status = 'active'
WHERE c.title LIKE 'تست — %'
  AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-13'
  AND cs.status <> 'cancelled';

-- Deterministic historical attendance matrix without UPDATE ... FROM.
UPDATE enrollment_sessions
SET
  status = CASE
    WHEN (
      CAST(substr((SELECT s.national_code FROM students s
                   JOIN enrollments e ON e.student_id = s.id
                   WHERE e.id = enrollment_sessions.enrollment_id), -1) AS INTEGER)
      + CAST(strftime('%d', (SELECT cs.session_date FROM class_sessions cs WHERE cs.id = enrollment_sessions.session_id)) AS INTEGER)
    ) % 10 IN (0,1) THEN 'excused'
    WHEN (
      CAST(substr((SELECT s.national_code FROM students s
                   JOIN enrollments e ON e.student_id = s.id
                   WHERE e.id = enrollment_sessions.enrollment_id), -1) AS INTEGER)
      + CAST(strftime('%d', (SELECT cs.session_date FROM class_sessions cs WHERE cs.id = enrollment_sessions.session_id)) AS INTEGER)
    ) % 10 IN (2,3,4) THEN 'absent'
    ELSE 'present'
  END,
  note = 'TEST DATA — historical attendance matrix'
WHERE session_id IN (
  SELECT cs.id FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id
  WHERE c.title LIKE 'تست — %'
    AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-13'
    AND cs.status <> 'cancelled'
)
AND enrollment_id IN (
  SELECT e.id FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE e.status = 'active' AND s.national_code LIKE '99%'
);

-- Preserve unmarked current-day records for the attendance UI.
UPDATE enrollment_sessions
SET status = 'pending', note = 'TEST DATA — intentionally unmarked current session'
WHERE session_id IN (
  SELECT cs.id FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id
  WHERE c.title LIKE 'تست — %' AND cs.session_date = '2026-09-14'
)
AND enrollment_id IN (
  SELECT e.id FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE e.status = 'active'
    AND s.national_code LIKE '99%'
    AND CAST(substr(s.national_code, -1) AS INTEGER) IN (1,6)
);

-- Teacher attendance for completed historical sessions only.
DELETE FROM teacher_session_attendance
WHERE session_id IN (
  SELECT cs.id FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id
  WHERE c.title LIKE 'تست — %'
    AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-13'
    AND cs.status = 'cancelled'
);

INSERT OR IGNORE INTO teacher_session_attendance (session_id, instructor_id, status, note)
SELECT
  cs.id,
  cs.instructor_id,
  CASE WHEN cs.id % 4 = 0 THEN 'absent' ELSE 'present' END,
  'TEST DATA — historical teacher attendance'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE c.title LIKE 'تست — %'
  AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-13'
  AND cs.status = 'completed';

CREATE INDEX IF NOT EXISTS idx_test_invoices_term_status
  ON invoices(enrollment_term_id, status);
CREATE INDEX IF NOT EXISTS idx_test_payments_invoice
  ON payments(invoice_id);
