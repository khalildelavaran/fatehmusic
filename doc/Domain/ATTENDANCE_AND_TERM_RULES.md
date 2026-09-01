# Attendance and Enrollment Term Rules

## Session consumption

For an EnrollmentTerm:

- `PRESENT` consumes one planned session.
- `ABSENT` consumes one planned session.
- `EXCUSED` does not consume a planned session.

`remaining_sessions = planned_sessions - consumed_sessions`.

## Term start

A session-based EnrollmentTerm starts at the first actual instructional ClassSession attended/assigned to the enrollment, not merely at the registration timestamp.

## Leave

Student leave is an EnrollmentSession state. It does not cancel the ClassSession and does not imply that other students are absent.

## Class cancellation

A cancelled ClassSession is a class-level event. It must not create student absences.

## Makeup

A makeup ClassSession is a new operational session. Its relationship to the original session must remain auditable.
