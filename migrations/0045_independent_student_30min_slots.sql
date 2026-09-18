-- Normalize legacy student schedules to independent 30-minute slots.
-- Only rows that still exactly mirror their parent class session are changed;
-- manually edited student times remain untouched.
UPDATE enrollment_sessions
SET
  start_time = (
    SELECT strftime(
      '%H:%M',
      datetime(
        '2000-01-01 ' || cs.start_time,
        '+' || (
          (
            SELECT COUNT(*)
            FROM enrollment_sessions prior
            WHERE prior.session_id = enrollment_sessions.session_id
              AND prior.id < enrollment_sessions.id
          ) * 30
        ) || ' minutes'
      )
    )
    FROM class_sessions cs
    WHERE cs.id = enrollment_sessions.session_id
  ),
  end_time = (
    SELECT strftime(
      '%H:%M',
      datetime(
        '2000-01-01 ' || cs.start_time,
        '+' || (
          (
            SELECT COUNT(*)
            FROM enrollment_sessions prior
            WHERE prior.session_id = enrollment_sessions.session_id
              AND prior.id < enrollment_sessions.id
          ) * 30 + 30
        ) || ' minutes'
      )
    )
    FROM class_sessions cs
    WHERE cs.id = enrollment_sessions.session_id
  )
WHERE start_time = (
    SELECT cs.start_time FROM class_sessions cs WHERE cs.id = enrollment_sessions.session_id
  )
  AND end_time = (
    SELECT cs.end_time FROM class_sessions cs WHERE cs.id = enrollment_sessions.session_id
  );

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions_schedule
  ON enrollment_sessions(session_id, start_time, end_time);
