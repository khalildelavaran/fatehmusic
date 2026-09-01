-- Operational integrity for student attendance rows.
-- A student-session row belongs to exactly one enrollment term.
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term_status
  ON enrollment_sessions(enrollment_term_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_enrollment_status
  ON enrollment_sessions(enrollment_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_terms_active
  ON enrollment_terms(enrollment_id, status, term_number DESC);
