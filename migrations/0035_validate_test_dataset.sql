-- ====================================================================
-- Migration 0035: deterministic validation/normalization for TEST data
--
-- This migration intentionally only touches TEST classes/students.
-- It repairs 0034 assumptions after 0033's teacher-attendance constraint
-- was corrected, and makes the daily dashboard data deterministic.
-- ====================================================================

-- Historical sessions: ensure every test class has concrete sessions from
-- 2026-09-01 through 2026-09-13 as well as the 0033 future range.
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

-- Ensure enrollment-session rows exist for historical sessions.
-- Cancelled sessions intentionally receive NO enrollment-session row;
-- the operational integrity trigger forbids attendance rows on them.
INSERT OR IGNORE INTO enrollment_sessions (
  enrollment_id, session_id, enrollment_term_id, status, attendance_mode, note
)
SELECT
  e.id,
  cs.id,
  et.id,
  'pending',
  CASE WHEN cs.location_type = 'online' THEN 'online' ELSE 'in_person' END,
  'TEST DATA — historical attendance case'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
JOIN enrollments e ON e.class_id = cs.class_id AND e.status = 'active'
LEFT JOIN enrollment_terms et
  ON et.enrollment_id = e.id AND et.status = 'active'
WHERE c.title LIKE 'تست — %'
  AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-13'
  AND cs.status <> 'cancelled';

-- Historical attendance matrix. The national-code suffix (1..10) gives
-- each student a stable cohort without relying on generated database IDs.
UPDATE enrollment_sessions
SET
  status = CASE
    WHEN ((CAST(substr(st.national_code, -1) AS INTEGER) + CAST(strftime('%d', cs.session_date) AS INTEGER)) % 10) IN (0,1) THEN 'excused'
    WHEN ((CAST(substr(st.national_code, -1) AS INTEGER) + CAST(strftime('%d', cs.session_date) AS INTEGER)) % 10) IN (2,3,4) THEN 'absent'
    ELSE 'present'
  END,
  note = 'TEST DATA — historical attendance matrix'
FROM class_sessions cs
JOIN enrollments e ON e.id = enrollment_sessions.enrollment_id
JOIN students st ON st.id = e.student_id
JOIN classes c ON c.id = cs.class_id
WHERE enrollment_sessions.session_id = cs.id
  AND c.title LIKE 'تست — %'
  AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-13'
  AND cs.status <> 'cancelled';

-- A small deterministic set of current-day records stays pending so the
-- attendance UI can still be tested from an unmarked state.
UPDATE enrollment_sessions
SET status = 'pending', note = 'TEST DATA — intentionally unmarked current session'
WHERE session_id IN (
  SELECT cs.id FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id
  WHERE c.title LIKE 'تست — %' AND cs.session_date = '2026-09-14'
)
AND enrollment_id IN (
  SELECT e.id FROM enrollments e
  JOIN students st ON st.id = e.student_id
  WHERE e.status = 'active' AND st.national_code LIKE '99%'
  AND CAST(substr(st.national_code, -1) AS INTEGER) IN (1, 6)
);

-- Teacher attendance: completed/cancelled historical sessions get a real
-- present/absent state. Cancelled sessions intentionally have no attendance
-- row because they should not participate in teacher attendance metrics.
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
  CASE WHEN (cs.id % 4) = 0 THEN 'absent' ELSE 'present' END,
  'TEST DATA — historical teacher attendance'
FROM class_sessions cs
JOIN classes c ON c.id = cs.class_id
WHERE c.title LIKE 'تست — %'
  AND cs.session_date BETWEEN '2026-09-01' AND '2026-09-13'
  AND cs.status = 'completed';

-- Finance cases. Every active test term gets a realistic tuition amount;
-- deterministic cohorts cover none/pending/partial/paid/overdue.
UPDATE enrollment_terms
SET
  tuition_amount = CASE
    WHEN (enrollment_id % 5) = 0 THEN 0
    WHEN (enrollment_id % 5) = 1 THEN 1600000
    WHEN (enrollment_id % 5) = 2 THEN 2000000
    WHEN (enrollment_id % 5) = 3 THEN 2400000
    ELSE 1800000
  END,
  billing_type = CASE WHEN (enrollment_id % 6) = 0 THEN 'monthly' ELSE 'session_based' END,
  planned_sessions = CASE WHEN (enrollment_id % 6) = 0 THEN 4 ELSE 16 END,
  tuition_due_date = CASE
    WHEN (enrollment_id % 5) = 4 THEN '2026-09-05'
    WHEN (enrollment_id % 5) = 3 THEN '2026-09-20'
    ELSE '2026-09-30'
  END
WHERE status = 'active'
  AND enrollment_id IN (
    SELECT e.id FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    JOIN students s ON s.id = e.student_id
    WHERE c.title LIKE 'تست — %' AND s.national_code LIKE '99%'
  );

-- One invoice per active test term where a non-zero tuition is configured.
INSERT INTO invoices (enrollment_term_id, amount, due_date, status, description)
SELECT
  et.id,
  et.tuition_amount,
  et.tuition_due_date,
  CASE
    WHEN (et.enrollment_id % 5) = 1 THEN 'pending'
    WHEN (et.enrollment_id % 5) = 2 THEN 'paid'
    WHEN (et.enrollment_id % 5) = 3 THEN 'pending'
    ELSE 'overdue'
  END,
  'TEST DATA — current tuition invoice'
FROM enrollment_terms et
JOIN enrollments e ON e.id = et.enrollment_id
JOIN classes c ON c.id = e.class_id
WHERE et.status = 'active'
  AND et.tuition_amount > 0
  AND c.title LIKE 'تست — %'
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.enrollment_term_id = et.id
      AND i.description = 'TEST DATA — current tuition invoice'
  );

-- Payments create partial and paid cases, including split payments.
INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id,
  CASE WHEN (i.id % 2) = 0 THEN CAST(i.amount * 0.40 AS INTEGER) ELSE i.amount END,
  '2026-09-10 12:00:00',
  CASE WHEN (i.id % 3) = 0 THEN 'card' WHEN (i.id % 3) = 1 THEN 'cash' ELSE 'transfer' END,
  printf('TEST-%06d-A', i.id),
  'TEST DATA — first payment'
FROM invoices i
JOIN enrollment_terms et ON et.id = i.enrollment_term_id
JOIN enrollments e ON e.id = et.enrollment_id
JOIN classes c ON c.id = e.class_id
WHERE c.title LIKE 'تست — %'
  AND i.description = 'TEST DATA — current tuition invoice'
  AND i.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);

INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id,
  i.amount - (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id),
  '2026-09-12 12:00:00',
  'transfer',
  printf('TEST-%06d-B', i.id),
  'TEST DATA — closing payment'
FROM invoices i
WHERE i.description = 'TEST DATA — current tuition invoice'
  AND i.status = 'paid'
  AND (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) > 0
  AND (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) < i.amount;

-- Partial-payment cohort: one 35% payment on invoices not already paid.
INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id,
  CAST(i.amount * 0.35 AS INTEGER),
  '2026-09-11 12:00:00',
  'card',
  printf('TEST-%06d-P', i.id),
  'TEST DATA — partial payment'
FROM invoices i
JOIN enrollment_terms et ON et.id = i.enrollment_term_id
WHERE i.description = 'TEST DATA — current tuition invoice'
  AND (et.enrollment_id % 5) = 3
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);

-- Cancelled invoices provide the explicit cancelled financial state while
-- leaving the active term itself active.
INSERT INTO invoices (enrollment_term_id, amount, due_date, status, description)
SELECT
  et.id, 900000, '2026-09-01', 'cancelled', 'TEST DATA — cancelled invoice'
FROM enrollment_terms et
JOIN enrollments e ON e.id = et.enrollment_id
JOIN classes c ON c.id = e.class_id
WHERE c.title LIKE 'تست — %'
  AND (et.enrollment_id % 10) = 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.enrollment_term_id = et.id AND i.description = 'TEST DATA — cancelled invoice'
  );

-- Useful historical terms: only some test enrollments receive a completed
-- previous term, preserving their current active term.
INSERT INTO enrollment_terms (
  enrollment_id, term_number, start_date, planned_sessions,
  billing_type, tuition_amount, tuition_due_date, status
)
SELECT
  e.id, 0, '2026-05-01', 12, 'session_based', 1200000, '2026-05-31', 'completed'
FROM enrollments e
JOIN classes c ON c.id = e.class_id
WHERE c.title LIKE 'تست — %'
  AND (e.id % 7) = 0
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_terms et
    WHERE et.enrollment_id = e.id AND et.term_number = 0
  );

INSERT INTO invoices (enrollment_term_id, amount, due_date, status, description)
SELECT
  et.id, et.tuition_amount, et.tuition_due_date, 'paid',
  'TEST DATA — previous completed term invoice'
FROM enrollment_terms et
JOIN enrollments e ON e.id = et.enrollment_id
JOIN classes c ON c.id = e.class_id
WHERE c.title LIKE 'تست — %'
  AND et.term_number = 0
  AND NOT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.enrollment_term_id = et.id
      AND i.description = 'TEST DATA — previous completed term invoice'
  );

INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
SELECT
  i.id, i.amount, '2026-05-25 12:00:00', 'transfer',
  printf('TEST-PREV-%06d', i.id), 'TEST DATA — previous term paid'
FROM invoices i
WHERE i.description = 'TEST DATA — previous completed term invoice'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);
