# Music School Domain Skill

## Purpose

Use this skill whenever a change touches the school-management domain: students, instructors, courses, classes, schedules, sessions, attendance, enrollment, tuition, invoices, payments, rooms, workshops, online/hybrid delivery, holidays, or makeup sessions.

## Mandatory project context

Before changing code, read `AGENTS.md`, `doc/Domain/DATA_MODEL.md`, `SCHOOL-MANAGEMENT-IMPLEMENTATION.md`, and the current relevant migrations/API modules. The public website architecture and the operational school-management domain are different concerns and must not be conflated.

## Current implementation reality

The current repository is a hybrid/static-to-operational architecture:

- `Course` is still primarily the canonical static catalog in `src/data/courses.js`, with D1 `course_overrides` for administrative edits.
- `Instructor` is a real D1 table (`instructors`) and also has public static content in `src/data/instructors.js`.
- `Student` is a real D1 table (`students`).
- `Registration` is a historical intake/registration record and must not be treated as the complete long-term enrollment model.
- `Registration.term` currently numbers registrations for a student. It is legacy registration semantics and is **not** the target definition of an instructional term.
- `Class` and `class_students` are real D1 tables from migration `0021_create_classes.sql`.
- There is currently no authoritative D1 `ClassSession`, `EnrollmentSession`, `Attendance`, `Room`, `Invoice`, or `Payment` table in the inspected migration set. Do not claim these already exist; add them only through deliberate migrations.
- `src/data/schedule.js` is currently a static schedule catalog. Its records contain weekday, duration, classroom and class mode, but not a real start/end time or a Class foreign key.

## Canonical vocabulary

- `Instructor` = مدرس. Never introduce `Teacher` in new code.
- `Student` = هنرجو.
- `Course` = موضوع/محصول آموزشی.
- `Class` = اجرای آموزشی مشخص associated with a course/instructor and operational enrollment.
- `ClassSchedule` = recurring/default timetable pattern.
- `ClassSession` = one real calendar occurrence.
- `Enrollment` = student's membership in a class. In the current schema, `class_students` is the existing operational predecessor and should be evolved rather than duplicated.
- `EnrollmentTerm` = a student's instructional/billing cycle; optional and enrollment-scoped.
- `EnrollmentSession` = one student's participation/attendance state for one ClassSession.
- `Attendance` = the domain behavior/record for presence; if a dedicated table is introduced, it must not duplicate EnrollmentSession semantics.
- `Invoice` = a tuition/debt charge.
- `Payment` = payment against an invoice.
- `Room` = physical resource at a branch.
- `Workshop` = a class/offering type, not a second scheduling system.

## Target domain model

```text
Course
  ↓
Class
  ├── ClassSchedule (optional recurring plan)
  └── ClassSession (real occurrence)
          ├── Instructor attendance
          └── EnrollmentSession
                    ↓
                Enrollment
                 ├── Student
                 └── EnrollmentTerm (optional)
                            ↓
                         Invoice
                            ↓
                         Payment
```

## Critical alignment rules

### Course vs Class

`Course` answers “what is taught?”. `Class` answers “which operational offering is running with which instructor, branch, capacity and enrollment?”. Do not put individual student scheduling into Course.

### Schedule vs Session

**Schedule is the recurring plan; Session is the real event.**

A ClassSession owns the effective date/time/location for that occurrence and may override the class schedule without mutating it.

A ClassSession must support one-off changes such as:

- different date
- different start/end time
- different instructor
- different room
- online/hybrid delivery
- cancellation
- makeup

A Session may exist without a recurring schedule, especially for workshops and makeup sessions.

### Current schedule limitation

Do not assume `src/data/schedule.js` is already a proper ClassSchedule table. It currently uses instructor IDs, weekday, duration and classroom values and lacks a real time range/Class relation. Any operational scheduling migration must explicitly map or replace this legacy catalog without fabricating historical times.

### Enrollment

The current `class_students` table is the existing operational enrollment relation. Evolve it toward the domain concept of `Enrollment`; do not create a second table with the same responsibility without a migration strategy.

An active student/class relationship must be unique.

### Registration vs Enrollment

`Registration` is intake/history. It is not a substitute for `Enrollment`.

Do not use `registrations.term` as the authoritative instructional term after the operational enrollment model is introduced.

Historical `Registration.term` must remain backward-compatible unless a dedicated data migration explicitly reconciles it.

### Student-specific term

A term is not a calendar season.

For session-based instruction, the term begins from the student's first applicable instructional session and contains a configurable entitlement such as:

- 4 sessions
- 8 sessions
- 10 sessions

Examples:

- guitar: commonly 8 sessions
- piano: commonly 10 sessions
- other offerings: 4, 8, 10, or another configured count

Never hard-code these as universal Course rules. The effective value belongs to the student's enrollment/term and may be configured by the academy.

### Monthly billing

Support at least:

- `SESSION_BASED`
- `MONTHLY`

Billing cadence and instructional scheduling are separate concepts.

A monthly billing cycle must not imply a fixed number of sessions unless explicitly configured by academy policy.

### Attendance

Attendance is student-per-session data.

Canonical student states:

- `PRESENT`: consumes one session entitlement.
- `ABSENT`: consumes one session entitlement.
- `EXCUSED`: approved leave; does not consume the student's entitlement.

If `LATE` is implemented, preserve it as a separate state only if the academy policy defines its consumption semantics.

Do not store a single attendance status on `ClassSession` for all students.

### Instructor attendance

Instructor attendance is independent of student attendance and must be represented separately.

### Remaining sessions

`remaining_sessions` is derived data, not an editable source of truth.

For a session-count term:

```text
consumed = PRESENT + ABSENT (+ policy-defined LATE)
remaining = planned_sessions - consumed
```

`EXCUSED` does not consume entitlement.

If counters are denormalized for performance, they must be derivable and reconciled from authoritative records.

### Leave vs cancellation

Student leave:

```text
EnrollmentSession.status = EXCUSED
```

The class session can continue for other students.

Whole-class cancellation:

```text
ClassSession.status = CANCELLED
```

with a reason such as `OFFICIAL_HOLIDAY`.

Never cancel the whole session to represent one student's leave.

### Makeup sessions

There are two distinct cases:

1. Whole-class makeup: a replacement `ClassSession` references the original cancelled session.
2. Student-specific makeup: a replacement `EnrollmentSession` references the original excused enrollment-session record.

A makeup can occur earlier or later than the normal schedule and may use a different date, time, room, delivery mode, and—if academy policy allows—different instructor.

Never mutate the recurring schedule to represent a one-off makeup.

### Official holidays

A holiday does not delete or rewrite the recurring schedule. A real generated session can be cancelled with a holiday reason. A makeup is created only when the academy decides one is required.

### Room

The current `classes.room` text field is a legacy/initial representation. The target operational model should introduce a real `Room` resource and reference it from Schedule and Session. Do not create duplicate room concepts.

The Session room is authoritative for the actual occurrence.

### Delivery mode

Online is not a separate academic hierarchy.

Target values:

- `IN_PERSON`
- `ONLINE`
- `HYBRID`

The current `classes.class_type` contains `online`; this is a known modeling mismatch. Do not perpetuate `online` as an academic class type in the target model. Separate **class type** from **delivery mode**.

A normally in-person Class may have an exceptional online Session.

### Workshop

A workshop reuses Class, ClassSession, Enrollment and EnrollmentSession infrastructure.

Target concept:

```text
Class.type = WORKSHOP
```

A workshop may have one or multiple Sessions and may have no recurring ClassSchedule.

A Workshop enrollment does not necessarily require EnrollmentTerm.

## Current-to-target mapping

| Current repository concept | Target domain concept | Action |
|---|---|---|
| `src/data/courses.js` | Course | Preserve canonical catalog |
| `course_overrides` | Course operational override | Preserve |
| `instructors` | Instructor | Preserve |
| `students` | Student | Preserve |
| `registrations` | Registration/intake history | Preserve; do not repurpose |
| `registrations.term` | Legacy registration numbering | Preserve for compatibility; not authoritative for new Term |
| `classes` | Class | Extend, do not duplicate |
| `class_students` | Enrollment predecessor | Evolve into/around Enrollment |
| `src/data/schedule.js` | Legacy schedule catalog | Do not treat as operational Session source |
| `classes.room` | Legacy room label | Eventually replace/augment with Room FK |
| `classes.class_type=online` | Delivery mode | Migrate semantics to `delivery_mode` |
| missing ClassSession table | ClassSession | Add deliberately |
| missing Attendance table | EnrollmentSession / attendance model | Add deliberately |
| missing Invoice/Payment tables | Finance model | Add deliberately |

## Implementation rules

1. Inspect the current migrations and API before changing schema.
2. Extend `students`, `instructors`, `classes`, and `class_students`; do not create duplicates.
3. Do not convert `Registration` into `Enrollment` by renaming it; they have different lifecycles.
4. Do not use `Registration.term` as the new instructional-term source of truth.
5. Add ClassSession before implementing the Today dashboard.
6. Add student-per-session attendance/enrollment records before implementing remaining-session calculations.
7. Add Room as a real resource only when operational scheduling needs it; preserve current room labels during migration.
8. Separate Class type from delivery mode.
9. Keep whole-class cancellation and student leave distinct.
10. Keep makeup relationships explicit and auditable.
11. Keep invoice/payment accounting separate from instructional session counts.
12. Enforce active-enrollment uniqueness at the database level.
13. Never accept client-calculated balances or remaining-session counts as authoritative.
14. Keep all management mutations server-authorized.
15. Preserve the existing public SEO/content architecture and its canonical Course/Instructor identities.
16. Do not fabricate historical schedule times or attendance records when migrating legacy data.
17. Every schema change requires a migration and corresponding tests/documentation.

## Dashboard rule

The reception/admin Today dashboard must query real `ClassSession` records for the selected date.

It must not derive today's operational truth directly from `src/data/schedule.js`.

For each Session show:

- time
- Class/Course
- Instructor
- Room or online mode
- Instructor attendance
- enrolled Students
- student attendance actions
- consumed/remaining session summary
- next invoice/due-date warning where applicable

Student attendance actions:

- green = present
- red = absent
- white = excused/leave

Do not reuse these attendance colors for financial meanings.

## Decision hierarchy

When implementation choices conflict, prefer:

1. Existing schema/data integrity and migration history.
2. This Domain Skill.
3. `doc/Domain/DATA_MODEL.md` and the school-management specification.
4. Auditability and maintainability.
5. UI convenience.

If existing documentation conflicts with the actual schema, document the discrepancy and resolve it explicitly. Never silently maintain two competing definitions.
