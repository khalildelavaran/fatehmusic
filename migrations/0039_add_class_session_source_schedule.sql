-- Fixes a materialization idempotency bug: class_sessions rows created
-- automatically from class_schedules (see materializeScheduledSessions in
-- src/pages/api/admin/daily-dashboard.ts) were previously matched on
-- (class_id, session_date, start_time). Once a session's start_time is
-- edited -- the whole point of the daily dashboard's drag/resize/inline
-- time editing -- it no longer matches its originating schedule, so the
-- next dashboard load would insert a duplicate session for the same
-- schedule slot.
--
-- source_schedule_id records which class_schedules row (if any) a session
-- was auto-generated from, so the idempotency check can key on that
-- instead of on a value the whole feature is designed to let users change.
-- NULL for manually created sessions (via src/pages/api/admin/class-sessions.ts)
-- and for makeup sessions.

ALTER TABLE class_sessions ADD COLUMN source_schedule_id INTEGER REFERENCES class_schedules(id);

-- Backfill existing auto-generated sessions: the schedule_id was already
-- embedded in `notes` as "...برنامه هفتگی #<id>" by the old code, so it can
-- be recovered instead of leaving every pre-existing row NULL (which would
-- make the very next dashboard load re-materialize a duplicate for each of
-- them, defeating the point of this migration).
UPDATE class_sessions
SET source_schedule_id = CAST(
  substr(notes, instr(notes, '#') + 1) AS INTEGER
)
WHERE source_schedule_id IS NULL
  AND notes LIKE '%برنامه هفتگی #%'
  AND instr(notes, '#') > 0;

CREATE INDEX IF NOT EXISTS idx_class_sessions_source_schedule
  ON class_sessions(source_schedule_id, session_date);
