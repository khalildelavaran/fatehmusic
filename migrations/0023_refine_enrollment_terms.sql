-- ====================================================================
-- Migration 0023: bind concrete student sessions to their exact term.
--
-- Canonical policy storage is class_term_settings (0029). We intentionally
-- do not duplicate billing/session defaults on classes.
-- ====================================================================

ALTER TABLE enrollment_sessions
  ADD COLUMN enrollment_term_id INTEGER REFERENCES enrollment_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id, enrollment_id);

-- Existing operational data, if any, is associated with the earliest known
-- term for the same enrollment. New data is assigned by session provisioning.
UPDATE enrollment_sessions
SET enrollment_term_id = (
  SELECT et.id
  FROM enrollment_terms et
  WHERE et.enrollment_id = enrollment_sessions.enrollment_id
  ORDER BY et.term_number ASC, et.id ASC
  LIMIT 1
)
WHERE enrollment_term_id IS NULL;
