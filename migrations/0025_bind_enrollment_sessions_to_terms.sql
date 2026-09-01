-- 0023 already owns enrollment_term_id on enrollment_sessions.
-- Keep this migration intentionally idempotent: only add the supporting index.
CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id);

-- Calendar exception date remains owned by the calendar-exception migration.
