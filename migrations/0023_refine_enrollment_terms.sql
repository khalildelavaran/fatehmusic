-- ====================================================================
-- Migration 0023: bind concrete student sessions to their exact term.
--
-- A student's term is a cycle of concrete sessions. The term is therefore
-- explicitly attached to each enrollment_session; progress must never be
-- inferred from dates alone.
-- ====================================================================

ALTER TABLE enrollment_sessions
  ADD COLUMN enrollment_term_id INTEGER REFERENCES enrollment_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id, enrollment_id);

-- Preserve existing data by associating it with the earliest known term.
UPDATE enrollment_sessions
SET enrollment_term_id = (
  SELECT et.id
  FROM enrollment_terms et
  WHERE et.enrollment_id = enrollment_sessions.enrollment_id
  ORDER BY et.term_number ASC
  LIMIT 1
)
WHERE enrollment_term_id IS NULL;

-- Nullable by design: provisioning may create the concrete session record
-- before the student's first actual occurrence establishes the active term.
