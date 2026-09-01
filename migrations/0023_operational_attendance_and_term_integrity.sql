-- Operational attendance + enrollment-term integrity.
-- 0022 is the canonical operational education schema on this branch.
-- This migration is additive and safe for existing enrollment_sessions rows.

ALTER TABLE enrollment_sessions ADD COLUMN enrollment_term_id INTEGER REFERENCES enrollment_terms(id) ON DELETE SET NULL;

-- Rebuild only the attendance table so pending can be a first-class state.
CREATE TABLE enrollment_sessions_v2 (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id         INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_id            INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  enrollment_term_id    INTEGER REFERENCES enrollment_terms(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  attendance_mode       TEXT,
  makeup_for_id         INTEGER REFERENCES enrollment_sessions(id) ON DELETE SET NULL,
  note                  TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('pending', 'present', 'absent', 'excused')),
  CHECK (attendance_mode IS NULL OR attendance_mode IN ('in_person', 'online'))
);

INSERT INTO enrollment_sessions_v2
  (id, enrollment_id, session_id, enrollment_term_id, status, attendance_mode, makeup_for_id, note, created_at, updated_at)
SELECT
  id, enrollment_id, session_id, enrollment_term_id, status, attendance_mode, makeup_for_id, note, created_at, updated_at
FROM enrollment_sessions;

DROP TABLE enrollment_sessions;
ALTER TABLE enrollment_sessions_v2 RENAME TO enrollment_sessions;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_sessions_unique
  ON enrollment_sessions(enrollment_id, session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_session
  ON enrollment_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_makeup
  ON enrollment_sessions(makeup_for_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_terms_one_active
  ON enrollment_terms(enrollment_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_enrollment_terms_lookup
  ON enrollment_terms(enrollment_id, status, start_date);
