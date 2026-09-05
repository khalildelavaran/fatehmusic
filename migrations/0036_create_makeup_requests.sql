-- ====================================================================
-- Migration 0036: makeup session requests
--
-- Adds the request/approval workflow on top of the existing makeup
-- infrastructure (class_sessions.type='makeup' + original_session_id,
-- enrollment_sessions.makeup_for_id, both enforced by triggers in
-- migration 0032). This table is the missing piece per
-- SCHOOL-MANAGEMENT-IMPLEMENTATION.md section 38: a student's excused
-- absence can generate a request that an admin/registrar reviews
-- before any makeup class_session is actually scheduled.
--
-- original_enrollment_session_id must reference an 'excused' absence
-- (enforced in application code, not a DB trigger, since 'excused' can
-- itself change after the request is created -- e.g. an admin
-- correcting a mis-marked attendance record should not retroactively
-- corrupt an already-approved request).
-- ====================================================================

CREATE TABLE IF NOT EXISTS makeup_requests (
  id                             INTEGER PRIMARY KEY AUTOINCREMENT,
  original_enrollment_session_id INTEGER NOT NULL REFERENCES enrollment_sessions(id),
  enrollment_id                  INTEGER NOT NULL REFERENCES enrollments(id),
  requested_by_type              TEXT NOT NULL,
  requested_by_id                INTEGER,
  reason                         TEXT NOT NULL DEFAULT '',
  status                         TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_id                 INTEGER,
  review_note                    TEXT NOT NULL DEFAULT '',
  makeup_session_id              INTEGER REFERENCES class_sessions(id),
  created_at                     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (requested_by_type IN ('student', 'instructor', 'admin', 'registrar')),
  CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_makeup_requests_enrollment ON makeup_requests(enrollment_id, status);
CREATE INDEX IF NOT EXISTS idx_makeup_requests_original_session ON makeup_requests(original_enrollment_session_id);
CREATE INDEX IF NOT EXISTS idx_makeup_requests_status ON makeup_requests(status);

-- One open (non-terminal) request per absence: prevents duplicate
-- pending/approved/scheduled requests piling up for the same missed
-- session. A rejected request does not block a fresh request for the
-- same absence (e.g. after providing better documentation), and a
-- completed request is historical, so both are excluded from the
-- partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_makeup_requests_one_open_per_session
  ON makeup_requests(original_enrollment_session_id)
  WHERE status IN ('pending', 'approved', 'scheduled');
