-- ====================================================================
-- Migration 0023: refine operational enrollment terms
--
-- A student's term is a cycle of concrete sessions. The term therefore
-- needs to be explicitly attached to each enrollment_session; counting
-- by date alone can accidentally pull a later term into the current one.
-- Class also stores the default term/billing policy; EnrollmentTerm keeps
-- a snapshot so later class-policy changes do not rewrite history.
-- ====================================================================

ALTER TABLE classes ADD COLUMN default_term_sessions INTEGER;
ALTER TABLE classes ADD COLUMN default_billing_type TEXT NOT NULL DEFAULT 'session_based';

ALTER TABLE enrollment_sessions ADD COLUMN enrollment_term_id INTEGER REFERENCES enrollment_terms(id);

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id, enrollment_id);

-- Existing operational data, if any, is associated with the earliest term.
UPDATE enrollment_sessions
SET enrollment_term_id = (
  SELECT et.id
  FROM enrollment_terms et
  WHERE et.enrollment_id = enrollment_sessions.enrollment_id
  ORDER BY et.term_number ASC
  LIMIT 1
)
WHERE enrollment_term_id IS NULL;

-- Do not enforce NOT NULL here: a session can be created before an
-- enrollment is attached to a term. The application service assigns the
-- term atomically when the first session is attached.
