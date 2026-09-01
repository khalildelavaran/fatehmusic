# Session Generation Rules

## Source of truth

`ClassSchedule` is the recurring plan. `ClassSession` is the operational occurrence.

## Generation

A regular occurrence is generated as `SCHEDULED` from the applicable schedule. Its actual date, time, teacher, room, and delivery mode are stored on the session.

## Official holidays

An official holiday creates a calendar warning only. It does not automatically cancel a session.

The session may remain scheduled, be cancelled explicitly, or be replaced/moved through a makeup session.

## Makeup sessions

A makeup session is a new session with `type = MAKEUP` and a reference to the original session. The original session is never overwritten or deleted.

## Overrides

Changing one session's date, time, teacher, room, or delivery mode must not mutate the recurring schedule.

## Attendance

Attendance is attached to the actual session. Student leave (`EXCUSED`) is different from cancellation of the entire session.
