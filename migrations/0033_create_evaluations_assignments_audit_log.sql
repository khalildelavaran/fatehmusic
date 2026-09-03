-- ====================================================================
-- Migration 0033: evaluations, assignments, audit log
--
-- Adds the three school-management domain concepts that were still
-- missing per SCHOOL-MANAGEMENT-IMPLEMENTATION.md and
-- .agents/skills/music-school-domain/SKILL.md:
--   - Evaluation: an instructor's assessment of a student, scoped to
--     an enrollment (optionally to one class_session).
--   - Assignment: practice/homework an instructor assigns a student,
--     scoped to an enrollment (optionally to one class_session).
--   - audit_log: a generic, append-only record of sensitive admin /
--     instructor operations across the domain.
--
-- Trigger definitions are kept out of this migration, consistent with
-- the note in 0032, since D1 remote migrations have had parser issues
-- with larger mixed DDL migrations.
-- ====================================================================

CREATE TABLE IF NOT EXISTS evaluations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id      INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_id         INTEGER REFERENCES class_sessions(id) ON DELETE SET NULL,
  instructor_id      INTEGER NOT NULL REFERENCES instructors(id),
  technique_score    INTEGER,
  rhythm_score       INTEGER,
  theory_score       INTEGER,
  performance_score  INTEGER,
  discipline_score   INTEGER,
  overall_score      INTEGER NOT NULL,
  comment            TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (overall_score BETWEEN 0 AND 100),
  CHECK (technique_score IS NULL OR technique_score BETWEEN 0 AND 100),
  CHECK (rhythm_score IS NULL OR rhythm_score BETWEEN 0 AND 100),
  CHECK (theory_score IS NULL OR theory_score BETWEEN 0 AND 100),
  CHECK (performance_score IS NULL OR performance_score BETWEEN 0 AND 100),
  CHECK (discipline_score IS NULL OR discipline_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS assignments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id      INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_id         INTEGER REFERENCES class_sessions(id) ON DELETE SET NULL,
  instructor_id      INTEGER NOT NULL REFERENCES instructors(id),
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  due_date           TEXT,
  status             TEXT NOT NULL DEFAULT 'assigned',
  student_comment    TEXT NOT NULL DEFAULT '',
  instructor_comment TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('assigned', 'in_progress', 'completed', 'reviewed'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type   TEXT NOT NULL,
  actor_id     INTEGER,
  actor_label  TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    INTEGER,
  metadata     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (actor_type IN ('admin', 'registrar', 'instructor', 'student', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_evaluations_enrollment ON evaluations(enrollment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_instructor ON evaluations(instructor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_session ON evaluations(session_id);

CREATE INDEX IF NOT EXISTS idx_assignments_enrollment ON assignments(enrollment_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_instructor ON assignments(instructor_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
