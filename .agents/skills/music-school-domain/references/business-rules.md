# Music School Domain — Business Rules

## Scheduling

- `ClassSchedule` is a recurring/default pattern.
- `ClassSession` is the real occurrence and may override date, time, instructor, room, and delivery mode.
- One-off changes must never mutate the recurring schedule.
- A workshop may have sessions without a recurring schedule.

## Student cycles

- A student's instructional cycle starts from the first applicable session for that enrollment.
- Session-count cycles may be 4, 8, 10, or another configured count.
- Different courses can use different defaults; never hard-code one universal term length.
- Monthly billing is supported and is not equivalent to a fixed session count.

## Attendance

- PRESENT consumes entitlement.
- ABSENT consumes entitlement.
- EXCUSED/leave does not consume entitlement.
- Student attendance is per enrollment/session.
- Instructor attendance is independent.
- Cancellation of a whole session is not student leave.

## Makeup

- A cancelled class can have a replacement ClassSession.
- An excused student can have a student-specific makeup attendance/session relationship.
- Makeup can occur earlier or later than the normal scheduled date.
- Makeup can use a different time and room and, if permitted by policy, a different instructor.

## Finance

- `Invoice` represents an amount owed.
- `Payment` represents money received against an invoice.
- Outstanding balance is calculated server-side as invoice amount minus payments.
- Do not create a second `Tuition` aggregate if `Invoice` already exists.

## Workshop

- Workshop is an offering/class type, not a separate scheduling engine.
- It may have one or multiple sessions.
- It may be one-time and have no recurring schedule.
- It may use direct enrollment + invoice/payment without requiring an EnrollmentTerm.

## Online / hybrid

- Online is a delivery mode, not a separate academic hierarchy.
- A regular in-person class may contain an exceptional online session.
- Hybrid attendance can vary by student in the same session.
