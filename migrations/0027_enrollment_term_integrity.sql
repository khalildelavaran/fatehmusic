-- ====================================================================
-- Migration 0027: enrollment term integrity
--
-- A term belongs to one enrollment. Only one active term may exist for
-- an enrollment at a time. Session occurrences are explicitly bound to
-- the term that owns their consumption.
-- ====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_terms_one_active
  ON enrollment_terms(enrollment_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_enrollment_terms_due
  ON enrollment_terms(status, tuition_due_date);

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_enrollment_term_session
  ON enrollment_sessions(enrollment_id, enrollment_term_id, session_id);

CREATE INDEX IF NOT EXISTS idx_teacher_session_attendance_session
  ON teacher_session_attendance(session_id, instructor_id);
