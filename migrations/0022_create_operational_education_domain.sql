-- ====================================================================
-- Migration 0022: operational education domain
--
-- Purpose:
--   Add the runtime model required for real class scheduling, sessions,
--   attendance, enrollment cycles, makeup sessions and billing.
--
-- Compatibility rules:
--   * Course remains the static src/data/courses.js catalog + overrides.
--   * registrations remains the public-registration/history model.
--   * class_students remains available for backward compatibility; new
--     operational code should use enrollments.
--   * No historical registration is guessed into a Class or Session.
--   * Existing classes are preserved; old class_type='online' is migrated
--     to delivery_mode='online' and class_type='individual'.
--
-- Domain rule:
--   Schedule = recurring plan; Session = actual scheduled occurrence.
-- ====================================================================

-- ---------------------------------------------------------------
-- Rooms / physical resources
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  branch_id   INTEGER,
  capacity    INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active', -- active | inactive
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_branch ON rooms(branch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- ---------------------------------------------------------------
-- Extend classes without replacing the existing table.
-- ---------------------------------------------------------------
ALTER TABLE classes ADD COLUMN default_room_id INTEGER REFERENCES rooms(id);
ALTER TABLE classes ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'in_person'; -- in_person | online | hybrid

-- Legacy class_type='online' was mixing teaching type with delivery mode.
UPDATE classes
SET delivery_mode = 'online', class_type = 'individual'
WHERE class_type = 'online';

CREATE INDEX IF NOT EXISTS idx_classes_delivery_mode ON classes(delivery_mode);
CREATE INDEX IF NOT EXISTS idx_classes_default_room ON classes(default_room_id);

-- ---------------------------------------------------------------
-- Recurring class schedule.
-- weekday: 0=Saturday, 1=Sunday, ... 6=Friday (Iranian week).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_schedules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id       INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  weekday        INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time     TEXT NOT NULL,
  end_time       TEXT NOT NULL,
  room_id        INTEGER REFERENCES rooms(id),
  teacher_id     INTEGER REFERENCES instructors(id),
  effective_from TEXT,
  effective_to   TEXT,
  status         TEXT NOT NULL DEFAULT 'active', -- active | inactive
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_class_schedules_class ON class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_weekday ON class_schedules(weekday);
CREATE INDEX IF NOT EXISTS idx_class_schedules_status ON class_schedules(status);

-- ---------------------------------------------------------------
-- Real calendar occurrences.
-- A Session is independent from the recurring Schedule after creation.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_sessions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id             INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  schedule_id          INTEGER REFERENCES class_schedules(id) ON DELETE SET NULL,
  session_date         TEXT NOT NULL,
  start_time           TEXT NOT NULL,
  end_time             TEXT NOT NULL,
  teacher_id           INTEGER REFERENCES instructors(id),
  room_id              INTEGER REFERENCES rooms(id),
  location_type        TEXT NOT NULL DEFAULT 'in_person', -- in_person | online | hybrid
  online_platform      TEXT,
  meeting_url          TEXT,
  type                 TEXT NOT NULL DEFAULT 'regular', -- regular | makeup
  status               TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled
  original_session_id  INTEGER REFERENCES class_sessions(id) ON DELETE SET NULL,
  cancellation_reason  TEXT,
  notes                TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date ON class_sessions(class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON class_sessions(status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_original ON class_sessions(original_session_id);

-- ---------------------------------------------------------------
-- Operational enrollment.
-- class_students is retained as a compatibility/read-model boundary.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id           INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id         INTEGER NOT NULL REFERENCES students(id),
  class_student_id   INTEGER REFERENCES class_students(id),
  enrolled_at        TEXT NOT NULL DEFAULT (datetime('now')),
  start_date         TEXT,
  end_date           TEXT,
  status             TEXT NOT NULL DEFAULT 'active', -- active | completed | withdrawn | paused
  notes              TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_one_active
  ON enrollments(class_id, student_id)
  WHERE status = 'active';

-- Backfill only the explicitly modeled operational class_students rows.
-- Existing class_students are not inferred from registrations.
INSERT INTO enrollments (class_id, student_id, class_student_id, enrolled_at, status, created_at)
SELECT cs.class_id, cs.student_id, cs.id, cs.enrollment_date, cs.status, cs.created_at
FROM class_students cs
WHERE NOT EXISTS (
  SELECT 1 FROM enrollments e WHERE e.class_student_id = cs.id
);

-- ---------------------------------------------------------------
-- Per-enrollment educational cycle / term.
-- A term is NOT a calendar quarter. It starts from the student's first
-- session in that cycle and may contain 4, 8, 10, ... sessions.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollment_terms (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id     INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  term_number       INTEGER NOT NULL,
  start_date        TEXT,
  end_date          TEXT,
  billing_type      TEXT NOT NULL DEFAULT 'session_based', -- session_based | monthly
  planned_sessions  INTEGER,
  duration_months   INTEGER,
  tuition_amount    INTEGER,
  tuition_due_date  TEXT,
  status            TEXT NOT NULL DEFAULT 'active', -- pending | active | completed | cancelled
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (enrollment_id, term_number),
  CHECK (planned_sessions IS NULL OR planned_sessions > 0),
  CHECK (duration_months IS NULL OR duration_months > 0)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_terms_enrollment ON enrollment_terms(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_terms_status ON enrollment_terms(status);
CREATE INDEX IF NOT EXISTS idx_enrollment_terms_due_date ON enrollment_terms(tuition_due_date);

-- ---------------------------------------------------------------
-- Student attendance in each real session.
-- EXCUSED does not consume a session; PRESENT and ABSENT do.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollment_sessions (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id              INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_id                 INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  enrollment_term_id         INTEGER REFERENCES enrollment_terms(id) ON DELETE SET NULL,
  attendance_status          TEXT NOT NULL DEFAULT 'pending', -- pending | present | absent | excused
  attendance_mode            TEXT, -- in_person | online
  makeup_for_enrollment_id   INTEGER REFERENCES enrollment_sessions(id) ON DELETE SET NULL,
  note                       TEXT NOT NULL DEFAULT '',
  recorded_at                TEXT,
  recorded_by                TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (enrollment_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_enrollment ON enrollment_sessions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_session ON enrollment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term ON enrollment_sessions(enrollment_term_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_status ON enrollment_sessions(attendance_status);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_makeup ON enrollment_sessions(makeup_for_enrollment_id);

-- ---------------------------------------------------------------
-- Teacher attendance is independent from student attendance.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_session_attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  teacher_id  INTEGER NOT NULL REFERENCES instructors(id),
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | present | absent
  check_in_at TEXT,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_session ON teacher_session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_teacher ON teacher_session_attendance(teacher_id);

-- ---------------------------------------------------------------
-- Billing: invoice is the obligation; payment records settlement.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_term_id  INTEGER REFERENCES enrollment_terms(id) ON DELETE SET NULL,
  enrollment_id       INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  amount              INTEGER NOT NULL CHECK (amount >= 0),
  due_date            TEXT,
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | paid | overdue | cancelled
  description         TEXT NOT NULL DEFAULT '',
  issued_at           TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at             TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_enrollment ON invoices(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_term ON invoices(enrollment_term_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  method        TEXT NOT NULL DEFAULT 'cash', -- cash | card | transfer | online
  reference     TEXT,
  paid_at       TEXT NOT NULL DEFAULT (datetime('now')),
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- ---------------------------------------------------------------
-- Calendar exceptions are informational/domain inputs. They do not
-- automatically delete or move Sessions.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_exceptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_date TEXT NOT NULL,
  type         TEXT NOT NULL, -- official_holiday | academy_closure | special_event
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (exception_date, type)
);

CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON calendar_exceptions(exception_date);
