-- Bind each student/session occurrence to the exact enrollment term.
ALTER TABLE enrollment_sessions ADD COLUMN enrollment_term_id INTEGER REFERENCES enrollment_terms(id);

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_term
  ON enrollment_sessions(enrollment_term_id);

-- Calendar exception date is the canonical date column used by the operational domain.
-- No data is deleted or rewritten here; existing exception rows remain intact.
