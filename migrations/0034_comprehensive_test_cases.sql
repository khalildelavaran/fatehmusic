-- ====================================================================
-- Migration 0034: comprehensive operational test cases
--
-- Extends 0033 with realistic historical attendance, leave/makeup,
-- finance states, multiple payments, and teacher attendance.
-- TEST DATA ONLY: every mutation is scoped to test classes/students.
-- Deterministic + idempotent.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Historical concrete sessions: 2026-09-01 .. 2026-09-13.
-- --------------------------------------------------------------------
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
  c.id, d.session_date, cs.start_time, cs.end_time, c.instructor_id, cs.room_id,
  CASE WHEN ((c.id + CAST(strftime('%d', d.session_date) AS INTEGER)) % 5) = 0 THEN 'online' ELSE 'in_person' END,
  'regular',
  CASE WHEN ((c.id + CAST(strftime('%d', d.session_date) AS INTEGER)) % 13) = 0 THEN 'cancelled' ELSE 'completed' END,
  CASE WHEN ((c.id + CAST(strftime('%d', d.session_date) AS INTEGER)) % 13) = 0
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
    WHERE x.class_id = c.id AND x.session_date = d.session_date
      AND x.start_time = cs.start_time AND x.end_time = cs.end_time
  );

-- --------------------------------------------------------------------
-- 2. Keep TEST session rows provisioned; add any missing rows.
-- Cancelled sessions intentionally receive NO enrollment-session row;
-- the operational integrity trigger forbids attendance rows on them.
-- --------------------------------------------------------------------
INSERT OR IGNORE INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status, attendance_mode, note
)
SELECT
  e.id, cs.id, et.id, 'pending',
  CASE WHEN cs.location_type = 'online' THEN 'online' ELSE 'in_person' END,
  'TEST DATA — attendance pending'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id AND c.title LIKE 'تست — %'
JOIN enrollments e ON e.class_id = c.id AND e.status = 'active'
LEFT JOIN enrollment_terms et
  ON et.enrollment_id = e.id AND et.status = 'active' AND et.term_number = 1
WHERE cs.type = 'regular'
  AND cs.status <> 'cancelled';

-- --------------------------------------------------------------------
-- 3. Historical attendance matrix.
-- --------------------------------------------------------------------
UPDATE enrollment_sessions
SET
  status = CASE
    WHEN cs.session_date > '2026-09-14' THEN 'pending'
    WHEN cs.session_date = '2026-09-14' THEN
      CASE (e.id % 4)
        WHEN 0 THEN 'present'
        WHEN 1 THEN 'absent'
        WHEN 2 THEN 'excused'
        ELSE 'pending'
      END
    ELSE
      CASE (e.id + cs.id) % 6
        WHEN 0 THEN 'excused'
        WHEN 1 THEN 'absent'
        WHEN 2 THEN 'present'
        WHEN 3 THEN 'present'
        WHEN 4 THEN 'absent'
        ELSE 'present'
      END
  END,
  attendance_mode = CASE
    WHEN cs.location_type = 'online' THEN 'online'
    ELSE CASE WHEN (e.id % 7) = 0 THEN 'online' ELSE 'in_person' END
  END,
  note = CASE
    WHEN cs.session_date = '2026-09-14' AND (e.id % 4) = 2 THEN 'TEST DATA — leave / excused'
    WHEN cs.session_date < '2026-09-14' AND ((e.id + cs.id) % 6) = 0 THEN 'TEST DATA — leave / excused'
    ELSE 'TEST DATA — attendance scenario'
  END
FROM class_sessions cs
JOIN enrollments e ON e.class_id = cs.class_id
WHERE enrollment_sessions.session_id = cs.id
  AND enrollment_sessions.enrollment_id = e.id
  AND cs.class_id IN (SELECT id FROM classes WHERE title LIKE 'تست — %');

-- --------------------------------------------------------------------
-- 4. Teacher attendance: only legal values are present / absent.
-- --------------------------------------------------------------------
UPDATE teacher_session_attendance
SET
  status = CASE WHEN (session_id + instructor_id) % 5 = 0 THEN 'absent' ELSE 'present' END,
  note = CASE WHEN (session_id + instructor_id) % 5 = 0
              THEN 'TEST DATA — teacher absent'
              ELSE 'TEST DATA — teacher present' END
WHERE session_id IN (
  SELECT cs.id FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id WHERE c.title LIKE 'تست — %'
);

INSERT OR IGNORE INTO teacher_session_attendance (session_id, instructor_id, status, note)
SELECT cs.id, cs.instructor_id,
       CASE WHEN (cs.id + cs.instructor_id) % 5 = 0 THEN 'absent' ELSE 'present' END,
       'TEST DATA — teacher attendance'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE c.title LIKE 'تست — %'
  AND cs.status <> 'cancelled';

-- --------------------------------------------------------------------
-- 5. Makeup sessions for a deterministic subset of historical leaves.
-- --------------------------------------------------------------------
INSERT INTO class_sessions (
  class_id, session_date, start_time, end_time, instructor_id, room_id,
  location_type, type, status, original_session_id, notes
)
SELECT
  cs.class_id, date(cs.session_date, '+14 day'), cs.start_time, cs.end_time,
  cs.instructor_id, cs.room_id, cs.location_type, 'makeup',
  CASE WHEN date(cs.session_date, '+14 day') < '2026-09-14' THEN 'completed' ELSE 'scheduled' END,
  cs.id, 'TEST DATA — makeup session for excused attendance'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE c.title LIKE 'تست — %'
  AND cs.type = 'regular' AND cs.status = 'completed'
  AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-05'
  AND (cs.id % 3) = 0
  AND EXISTS (SELECT 1 FROM enrollment_sessions es WHERE es.session_id = cs.id AND es.status = 'excused')
  AND NOT EXISTS (SELECT 1 FROM class_sessions m WHERE m.original_session_id = cs.id);

INSERT OR IGNORE INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status, attendance_mode, makeup_for_id, note
)
SELECT
  original.enrollment_id, makeup.id, original.enrollment_term_id,
  CASE WHEN makeup.status = 'completed' THEN 'present' ELSE 'pending' END,
  original.attendance_mode, original.id,
  'TEST DATA — makeup occurrence linked to excused session'
FROM class_sessions makeup
JOIN enrollment_sessions original ON original.session_id = makeup.original_session_id
JOIN enrollments e ON e.id = original.enrollment_id AND e.status = 'active'
WHERE makeup.type = 'makeup' AND makeup.original_session_id IS NOT NULL
  AND original.status = 'excused';

-- --------------------------------------------------------------------
-- 6. Realistic current-term finance mix.
-- --------------------------------------------------------------------
UPDATE enrollment_terms
SET
  billing_type = CASE WHEN enrollment_id % 3 = 0 THEN 'monthly' ELSE 'session_based' END,
  planned_sessions = CASE WHEN enrollment_id % 3 = 0 THEN 4 ELSE 16 END,
  tuition_amount = CASE
    WHEN enrollment_id % 3 = 0 THEN 4800000
    WHEN enrollment_id % 3 = 1 THEN 6400000
    ELSE 5600000
  END,
  tuition_due_date = CASE
    WHEN enrollment_id % 6 IN (1, 5) THEN '2026-09-20'
    WHEN enrollment_id % 6 = 4 THEN '2026-09-10'
    ELSE '2026-09-30'
  END
WHERE status = 'active'
  AND enrollment_id IN (
    SELECT e.id
    FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    JOIN students s ON s.id = e.student_id
    WHERE c.title LIKE 'تست — %' AND s.national_code LIKE '99%'
  );

INSERT INTO invoices (enrollment_term_id, amount, due_date, status, description)
SELECT
  et.id, et.tuition_amount,
  et.tuition_due_date,
  CASE (e.id % 6)
    WHEN 1 THEN 'pending'
    WHEN 2 THEN 'pending'
    WHEN 3 THEN 'paid'
    WHEN 4 THEN 'overdue'
    WHEN 5 THEN 'cancelled'
    ELSE 'pending'
  END,
  'TEST DATA — current term finance scenario'
FROM enrollment_terms et
JOIN enrollments e ON e.id = et.enrollment_id
JOIN classes c ON c.id = e.class_id
JOIN students s ON s.id = e.student_id
WHERE et.status = 'active' AND c.title LIKE 'تست — %' AND s.national_code LIKE '99%'
  AND (e.id % 6) <> 0
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.enrollment_term_id = et.id);

-- Partial payments: two installments, leaving a balance.
INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id, CAST(i.amount * 30 / 100 AS INTEGER), '2026-09-05 10:00:00', 'cash',
  printf('TEST-PARTIAL-%06d-A', i.id), 'TEST DATA — first partial payment'
FROM invoices i
JOIN enrollment_terms et ON et.id = i.enrollment_term_id
JOIN enrollments e ON e.id = et.enrollment_id
WHERE i.description LIKE 'TEST DATA —%' AND i.status = 'pending' AND (e.id % 6) = 2
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);

INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id, CAST(i.amount * 20 / 100 AS INTEGER), '2026-09-10 18:30:00', 'card',
  printf('TEST-PARTIAL-%06d-B', i.id), 'TEST DATA — second partial payment'
FROM invoices i
JOIN enrollment_terms et ON et.id = i.enrollment_term_id
JOIN enrollments e ON e.id = et.enrollment_id
WHERE i.description LIKE 'TEST DATA —%' AND i.status = 'pending' AND (e.id % 6) = 2
  AND (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = i.id) = 1;

-- Fully paid invoices: two payments using different methods.
INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id, CAST(i.amount * 60 / 100 AS INTEGER), '2026-09-03 09:15:00', 'transfer',
  printf('TEST-PAID-%06d-A', i.id), 'TEST DATA — first payment'
FROM invoices i
JOIN enrollment_terms et ON et.id = i.enrollment_term_id
JOIN enrollments e ON e.id = et.enrollment_id
WHERE i.description LIKE 'TEST DATA —%' AND i.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);

INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id,
  i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0),
  '2026-09-08 14:20:00', 'card', printf('TEST-PAID-%06d-B', i.id),
  'TEST DATA — final payment'
FROM invoices i
JOIN enrollment_terms et ON et.id = i.enrollment_term_id
JOIN enrollments e ON e.id = et.enrollment_id
WHERE i.description LIKE 'TEST DATA —%' AND i.status = 'paid'
  AND (SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id) < i.amount;

-- --------------------------------------------------------------------
-- 7. Test-only indexes for dashboard/finance lookups.
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_test_invoices_term_status ON invoices(enrollment_term_id, status);
CREATE INDEX IF NOT EXISTS idx_test_payments_invoice ON payments(invoice_id);
