-- Class-level defaults for a student's instructional/billing cycle.
-- Values are copied into EnrollmentTerm when the first concrete
-- ClassSession starts a new active term.
CREATE TABLE IF NOT EXISTS class_term_settings (
  class_id          INTEGER PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  billing_type      TEXT NOT NULL DEFAULT 'session_based',
  planned_sessions  INTEGER,
  tuition_amount    INTEGER,
  tuition_due_days  INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (billing_type IN ('session_based', 'monthly')),
  CHECK (planned_sessions IS NULL OR planned_sessions > 0),
  CHECK (tuition_amount IS NULL OR tuition_amount >= 0),
  CHECK (tuition_due_days IS NULL OR tuition_due_days >= 0),
  CHECK (billing_type <> 'session_based' OR planned_sessions IS NOT NULL),
  CHECK (billing_type <> 'monthly' OR planned_sessions IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_class_term_settings_billing
  ON class_term_settings(billing_type);
