-- ====================================================================
-- Migration 0022: operational education domain
--
-- Schedule = recurring template.
-- Session = concrete occurrence.
-- Enrollment = student membership in a class.
-- Enrollment Session = that student's status for one concrete session.
--
-- The legacy classes.room / class_students structures remain intact for
-- compatibility. New operational code must use the normalized tables
-- below. Existing class_students rows are intentionally not copied here:
-- migration 0021 explicitly defines the operational Classes feature as
-- forward-looking and admin-populated.
-- ====================================================================

CREATE TABLE IF NOT EXISTS rooms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id    INTEGER,
  name         TEXT NOT NULL,
  capacity     INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'active',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_branch ON rooms(branch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

CREATE TABLE IF NOT EXISTS class_schedules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id       INTEGER NOT NULL REFERENCES classes(id),
  day_of_week    INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TEXT NOT NULL,
  end_time       TEXT NOT NULL,
  room_id        INTEGER REFERENCES rooms(id),
  effective_from TEXT,
  effective_to   TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_class_schedules_class ON class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_day ON class_schedules(day_of_week, start_time);

CREATE TABLE IF NOT EXISTS class_sessions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id              INTEGER NOT NULL REFERENCES classes(id),
  session_date          TEXT NOT NULL,
  start_time            TEXT NOT NULL,
  end_time              TEXT NOT NULL,
  instructor_id         INTEGER NOT NULL REFERENCES instructors(id),
  room_id               INTEGER REFERENCES rooms(id),
  location_type         TEXT NOT NULL DEFAULT 'in_person',
  online_platform       TEXT,
  meeting_url           TEXT,
  type                  TEXT NOT NULL DEFAULT 'regular',
  status                TEXT NOT NULL DEFAULT 'scheduled',
  cancellation_reason   TEXT,
  original_session_id   INTEGER REFERENCES class_sessions(id),
  notes                 TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (location_type IN ('in_person', 'online', 'hybrid')),
  CHECK (type IN ('regular', 'makeup')),
  CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON class_sessions(session_date, start_time);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class ON class_sessions(class_id, session_date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_original ON class_sessions(original_session_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id           INTEGER NOT NULL REFERENCES classes(id),
  student_id         INTEGER NOT NULL REFERENCES students(id),
  enrolled_at        TEXT NOT NULL DEFAULT (datetime('now')),
  status             TEXT NOT NULL DEFAULT 'active',
  source_class_student_id INTEGER REFERENCES class_students(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('active', 'completed', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_one_active
  ON enrollments(class_id, student_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS enrollment_terms (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id     INTEGER NOT NULL REFERENCES enrollments(id),
  term_number       INTEGER NOT NULL DEFAULT 1,
  start_date        TEXT NOT NULL,
  planned_sessions  INTEGER,
  billing_type      TEXT NOT NULL DEFAULT 'session_based',
  tuition_amount    INTEGER,
  tuition_due_date  TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (planned_sessions IS NULL OR planned_sessions > 0),
  CHECK (billing_type IN ('session_based', 'monthly')),
  CHECK (status IN ('active', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_enrollment_terms_enrollment ON enrollment_terms(enrollment_id, term_number);

CREATE TABLE IF NOT EXISTS enrollment_sessions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id         INTEGER NOT NULL REFERENCES enrollments(id),
  session_id            INTEGER NOT NULL REFERENCES class_sessions(id),
  status                TEXT NOT NULL DEFAULT 'absent',
  attendance_mode       TEXT,
  makeup_for_id         INTEGER REFERENCES enrollment_sessions(id),
  note                  TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('present', 'absent', 'excused')),
  CHECK (attendance_mode IS NULL OR attendance_mode IN ('in_person', 'online'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_sessions_unique
  ON enrollment_sessions(enrollment_id, session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_session ON enrollment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_makeup ON enrollment_sessions(makeup_for_id);

CREATE TABLE IF NOT EXISTS teacher_session_attendance (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     INTEGER NOT NULL REFERENCES class_sessions(id),
  instructor_id  INTEGER NOT NULL REFERENCES instructors(id),
  status         TEXT NOT NULL DEFAULT 'absent',
  check_in_at    TEXT,
  note           TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('present', 'absent'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_session_attendance_unique
  ON teacher_session_attendance(session_id, instructor_id);

CREATE TABLE IF NOT EXISTS calendar_exceptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_date TEXT NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON calendar_exceptions(exception_date);

CREATE TABLE IF NOT EXISTS invoices (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_term_id INTEGER NOT NULL REFERENCES enrollment_terms(id),
  amount             INTEGER NOT NULL CHECK (amount >= 0),
  due_date           TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',
  description        TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_term ON invoices(enrollment_term_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices(status, due_date);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  paid_at      TEXT NOT NULL DEFAULT (datetime('now')),
  method       TEXT,
  reference    TEXT,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- Additive fields to the existing classes table.
ALTER TABLE classes ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'in_person';
ALTER TABLE classes ADD COLUMN default_room_id INTEGER REFERENCES rooms(id);

-- Existing legacy value "online" means an individual class whose delivery
-- mode is online. Do this before application code starts enforcing the new
-- vocabulary.
UPDATE classes
SET class_type = 'individual', delivery_mode = 'online'
WHERE class_type = 'online';
