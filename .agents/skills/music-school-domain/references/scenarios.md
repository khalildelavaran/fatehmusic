# Music School Domain — Scenarios

## Scenario 1: 8-session guitar enrollment

Student registers for guitar. The first applicable session starts the student's cycle. The cycle has 8 planned sessions.

If records are:

```text
PRESENT
PRESENT
ABSENT
EXCUSED
PRESENT
PRESENT
```

then 5 sessions are consumed and 3 remain. `EXCUSED` is not consumed.

## Scenario 2: 10-session piano enrollment

A piano enrollment may use 10 planned sessions. This is an enrollment/term configuration, not a universal Course rule.

## Scenario 3: Monthly billing

A monthly-billed enrollment may have a monthly invoice/due date even if its weekly schedule continues. Do not infer a fixed session entitlement from the billing method.

## Scenario 4: Official holiday

A Saturday regular session is generated from the recurring schedule. The date is an official holiday. The session is marked `CANCELLED` with the holiday reason. The schedule remains unchanged. Management may create a makeup session on another date/time/room.

## Scenario 5: Student leave

The class session continues. One student is marked `EXCUSED`; other students can be `PRESENT`. Only the excused student's entitlement is preserved.

## Scenario 6: Student makeup

A student has an excused session. A later or earlier available session is assigned as makeup. The makeup relationship points to the original student-session record and does not alter the recurring class schedule.

## Scenario 7: One-off room change

The recurring schedule says room 2. A particular session must use room 3. Change the session room only.

## Scenario 8: One-off online session

The class default is in-person. A particular session is moved online. Set the session delivery mode to online and provide its meeting information. Do not create a duplicate online class unless there is a separate business requirement.

## Scenario 9: Hybrid session

A session may have one student attending in person and another online. Attendance mode can be stored per enrollment-session when required.

## Scenario 10: Workshop

A workshop may have one session or several. It can have no recurring schedule. It still uses ClassSession, Enrollment, EnrollmentSession, Invoice, and Payment infrastructure.
