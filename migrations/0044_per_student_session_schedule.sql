-- Per-student daily schedule overrides.
-- A class_session represents the teacher/room slot, while each enrollment_session
-- owns its student's actual 30-minute start/end time.
ALTER TABLE enrollment_sessions ADD COLUMN start_time TEXT;
ALTER TABLE enrollment_sessions ADD COLUMN end_time TEXT;

UPDATE enrollment_sessions
SET start_time = (SELECT cs.start_time FROM class_sessions cs WHERE cs.id = enrollment_sessions.session_id),
    end_time = (SELECT cs.end_time FROM class_sessions cs WHERE cs.id = enrollment_sessions.session_id)
WHERE start_time IS NULL OR end_time IS NULL;

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_schedule
  ON enrollment_sessions(session_id, start_time, end_time);
