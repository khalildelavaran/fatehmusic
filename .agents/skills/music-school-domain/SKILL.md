# Music School Domain Skill

## Purpose

Use this skill whenever a change touches the school-management domain: students, instructors, courses, classes, schedules, sessions, attendance, enrollment, tuition, payments, rooms, workshops, online/hybrid delivery, holidays, or makeup sessions.

## Mandatory project context

Before changing code, follow the repository instructions in `AGENTS.md` and read the project context documents required there. Do not redesign the existing public SEO/site architecture while implementing management features.

## Canonical vocabulary

- `Instructor` = مدرس. Do not introduce `Teacher` in new code.
- `Student` = هنرجو.
- `Course` = موضوع/محصول آموزشی؛ e.g. guitar, piano.
- `Class` = اجرای آموزشی مشخص of a course with instructor/branch/capacity.
- `ClassSchedule` = recurring/default timetable. It is a pattern, not a real event.
- `ClassSession` = a real scheduled occurrence. It is the source of truth for date/time/location of a particular meeting.
- `Enrollment` = student's membership in a class.
- `EnrollmentTerm` = a student's instructional/billing cycle; optional and enrollment-scoped.
- `EnrollmentSession` = one student's status in one class session.
- `Invoice` = debt/tuition charge. Use the existing project `Invoice` model; do not introduce `Tuition` as a duplicate finance aggregate.
- `Payment` = payment against an invoice.
- `Room` = physical resource at a branch.
- `Workshop` = a class/offering type, not a second scheduling/attendance system.

## Core domain rules

### Course vs Class

`Course` answers “what is taught?”. `Class` answers “which instructional offering is running with which instructor/branch/capacity?”. Keep them separate.

### Schedule vs Session

**Schedule is the recurring plan; Session is the real event.**

A session may override schedule values without mutating the schedule:

- date
- start/end time
- instructor
- room
- delivery/location mode
- status

A session may exist without a recurring schedule, especially for workshops and makeup sessions.

### Enrollment

A student may be enrolled in a class once while the enrollment is active. Do not create duplicate active enrollments for the same student/class.

### Student-specific term

A term is not necessarily a calendar season. In this academy domain, the cycle starts from the student's first applicable session and may contain a configurable number of sessions such as 4, 8, or 10.

Examples:

- guitar: commonly 8 sessions
- piano: commonly 10 sessions
- other offerings: 4, 8, 10, or another configured count

Do not hard-code these counts globally; they are business configuration/defaults and may vary by enrollment.

`EnrollmentTerm` belongs to `Enrollment`, not to `Course` globally.

### Billing model

Support at least:

- `SESSION_BASED`: a cycle is based on a planned number of sessions.
- `MONTHLY`: billing is based on a calendar/monthly period rather than a fixed session count.

Billing and instructional scheduling are related but must not be collapsed into one concept.

### Attendance

Attendance is student-per-session data and must not be stored only on `ClassSession`.

Canonical statuses:

- `PRESENT`: consumes one session.
- `ABSENT`: consumes one session.
- `EXCUSED`: approved leave; does **not** consume the student's session entitlement.

If the existing system supports `LATE`, preserve it, but define whether it consumes a session according to the school's policy. Do not silently change existing semantics.

### Teacher/instructor attendance

Instructor attendance is independent from student attendance. Use the existing terminology `Instructor` and an instructor-session attendance record where required.

### Remaining sessions

Do not treat `remaining_sessions` as an independently editable source of truth. Derive it from the enrollment term and actual student-session records.

For a session-count cycle:

`consumed = PRESENT + ABSENT (+ policy-defined LATE)`

`remaining = planned_sessions - consumed`

`EXCUSED` does not consume entitlement.

If denormalized counters are introduced for performance, they must be derived/reconciled and never become the authoritative business rule.

### Leave vs cancellation

These are different:

- Student leave: `EnrollmentSession.status = EXCUSED` while the class session may continue for other students.
- Whole class cancellation: `ClassSession.status = CANCELLED` with a reason such as `OFFICIAL_HOLIDAY`.

Never model a student leave by cancelling the whole session.

### Makeup sessions

There are two distinct cases:

1. Whole-class makeup: a replacement `ClassSession` references the cancelled/original session.
2. Student-specific makeup: a student's `EnrollmentSession` references the excused/original enrollment-session record.

A makeup session may occur on a different date, earlier or later than the normal schedule, at a different time, in a different room, and if business rules permit, with a different instructor.

Do not mutate the recurring schedule to represent a one-off makeup.

### Official holidays

A holiday does not delete or rewrite the recurring schedule. A generated real session can be marked cancelled with a cancellation reason, then a makeup session can be created if the academy chooses.

### Room

The schedule room is a default/preferred resource. The session room is the actual resource for that occurrence and may differ.

### Delivery mode

Online is not a separate academic domain.

Support delivery/location modes such as:

- `IN_PERSON`
- `ONLINE`
- `HYBRID`

A normally in-person class may have an exceptional online session. A hybrid session may have different students attending in person or online. Do not create a separate online-class hierarchy unless the existing architecture requires it.

### Workshop

A workshop uses the same class/session/enrollment/attendance infrastructure.

`Class.type = WORKSHOP` (or the repository's existing equivalent) is preferred over a parallel Workshop system.

A workshop may be one session or multiple sessions and may have no recurring `ClassSchedule`.

A workshop does not necessarily require `EnrollmentTerm`; an enrollment can instead be tied directly to its existing finance model.

## Dashboard requirements

The reception/admin “Today” dashboard must be driven by real `ClassSession` records for the selected date, not merely by recurring schedules.

For each session show:

- time
- class/course
- instructor
- room or online mode
- instructor attendance
- enrolled students
- each student's attendance action
- remaining/consumed session summary
- invoice/payment warning where applicable

Student attendance actions must clearly distinguish:

- green = present
- red = absent
- white = excused/leave

Do not reuse those colors for unrelated financial/status meanings.

The small student card should support, as appropriate:

- overall status indicator
- sessions consumed
- sessions remaining
- next invoice/due-date warning

## Existing repository constraints

The repository already defines `Instructor`, `Student`, `Course`, `Branch`, `Registration`, `Contract`, `Certificate`, `Class`, `Class Session`, `Attendance`, `Invoice`, and `Payment` terminology in its school-management specification. Extend existing entities instead of creating duplicates.

In particular:

- use `Instructor`, never add a new `Teacher` aggregate;
- use `Invoice`/`Payment`, not a parallel `Tuition`/payment system;
- inspect existing Class/Session/Attendance models before adding new tables;
- preserve Registration/Contract/Certificate relationships;
- follow the existing authentication/authorization model;
- server-side authorization is mandatory for attendance and management mutations.

## Implementation rules

1. Inspect current schema/migrations/API before adding a model.
2. Search for existing entities and relations before creating new ones.
3. Prefer extending existing models over duplicate aggregates.
4. Keep business rules in the server/service/data-access layer, not only in UI code.
5. Enforce uniqueness and integrity at the database level where practical.
6. Prevent duplicate attendance records for the same enrollment/session.
7. Prevent active duplicate enrollment for the same student/class.
8. Validate room and instructor scheduling conflicts server-side.
9. Never allow client-supplied calculated balances/counters to become authoritative.
10. Preserve auditability of attendance and finance changes.
11. Do not break existing public SEO URLs or frozen content architecture.
12. Run the repository's required checks before committing, including `astro check` and `npm run build` when applicable.

## Decision hierarchy

When an implementation choice conflicts with a convenient UI shortcut, prefer:

1. Existing repository architecture and data integrity.
2. The domain rules in this skill.
3. Existing school-management specification.
4. Maintainability and auditability.
5. UI convenience.

If existing code contradicts this skill, inspect the existing implementation and documentation first; do not silently create two competing models. Update the skill/domain documentation when the business rule is intentionally changed.
