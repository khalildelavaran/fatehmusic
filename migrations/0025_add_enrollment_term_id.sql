-- Bind each concrete student/session occurrence to the term that owns it.
-- This migration must run before 0026, which rebuilds enrollment_sessions.
ALTER TABLE enrollment_sessions
  ADD COLUMN enrollment_term_id INTEGER REFERENCES enrollment_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id);
