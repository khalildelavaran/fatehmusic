-- EnrollmentSession -> EnrollmentTerm binding is introduced by 0023.
-- Keep this migration as a compatibility checkpoint for databases that
-- already recorded the historical filename, without adding the column twice.
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id);
