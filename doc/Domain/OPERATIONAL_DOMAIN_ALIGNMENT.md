# Operational Domain Alignment

**Status:** Approved for implementation planning

**Scope:** School-management operational domain

**Repository:** `khalildelavaran/fatehmusic`

## 1. Executive finding

The repository already contains the first operational pieces of the school-management domain, but the current schema is not yet the complete domain described by the newer business rules.

The most important existing pieces are:

- `students`
- `instructors`
- `registrations`
- `classes`
- `class_students`
- `course_overrides`

The operational scheduling/attendance/finance model is incomplete. In particular, the inspected migration set does not yet contain authoritative tables for:

- ClassSession
- EnrollmentSession
- Attendance
- Room
- Invoice
- Payment

Therefore these concepts must not be assumed to exist merely because they are mentioned in older planning documents.

## 2. Existing schema reality

### Course

The public Course catalog remains primarily static in `src/data/courses.js`. D1 `course_overrides` stores administrative overrides rather than being a complete relational Course table.

This is intentional and should be preserved for the public/content architecture.

### Instructor

`instructors` is a real D1 operational table. Its seeded IDs intentionally match the public static instructor catalog.

### Student

`students` is a real D1 person-level table keyed by `national_code`.

### Registration

`registrations` represents registration/intake history. It contains snapshots of instrument, instructor and schedule information and has a legacy `term` number.

It must remain a historical/intake concept.

### Class

`classes` is a real D1 table with:

- course_id
- instructor_id
- room (text)
- class_type
- capacity
- level
- start_date/end_date
- status

`class_students` is the current student-to-class relationship and is the natural predecessor of the target Enrollment model.

### Schedule

`src/data/schedule.js` is currently a static schedule catalog. It stores instructor, weekday, session duration, classroom and class mode, but it does not represent an operational recurring schedule tied to a Class with explicit start/end times.

It must not be treated as a source of truth for actual daily sessions.

## 3. Known semantic conflicts

### 3.1 Legacy Registration.term vs target EnrollmentTerm

Current registration logic numbers registrations for the same student. The target business rule defines a term as the student's instructional/billing cycle beginning with the student's first applicable session.

These are different concepts.

Decision:

- Preserve `registrations.term` for historical compatibility.
- Introduce `EnrollmentTerm` for the new operational model.
- Never use `registrations.term` as the authoritative source for remaining instructional sessions.

### 3.2 Class.class_type mixes academic type and delivery mode

Current values include:

```text
individual
 group
 workshop
 online
```

`online` is not the same category as `individual`, `group`, or `workshop`.

Target model:

```text
class_type:
  INDIVIDUAL
  GROUP
  WORKSHOP

delivery_mode:
  IN_PERSON
  ONLINE
  HYBRID
```

A migration should preserve existing data while separating these concepts.

### 3.3 Class.room is text, not a resource

The current `classes.room` field is a free-text room label.

Target model requires a reusable `Room` resource associated with a Branch, with the actual Session room stored independently from the default schedule/class room.

Do not delete the legacy field until data has been reconciled.

### 3.4 Class has dates but no real sessions

`start_date` and `end_date` on Class describe the class lifecycle, not individual meeting occurrences.

The target system requires `ClassSession` for every actual scheduled occurrence.

## 4. Target operational model

```text
Course
  │
  ▼
Class
  │
  ├── ClassSchedule ───── recurring/default plan
  │
  └── ClassSession ────── real calendar occurrence
          │
          ├── InstructorSessionAttendance
          │
          └── EnrollmentSession
                    │
                    ▼
                Enrollment
                 │       │
                 │       └── Student
                 │
                 └── EnrollmentTerm
                          │
                          └── Invoice
                                │
                                └── Payment
```

## 5. Recommended migration sequence

### Migration A — operational scheduling foundation

Introduce:

- `rooms`
- `class_schedules`
- `class_sessions`

Do not fabricate historical start times from the current static schedule where no time exists.

### Migration B — Enrollment foundation

Either evolve `class_students` into the operational Enrollment model or introduce a clearly named `enrollments` table while preserving historical compatibility.

The decision should be made from actual API usage before migration.

### Migration C — student/session participation

Introduce the student-per-session record:

```text
EnrollmentSession
```

This record owns:

- enrollment
- session
- attendance state
- leave state
- makeup relationship

### Migration D — instructor attendance

Introduce an instructor-session attendance record independently from student attendance.

### Migration E — term/billing

Introduce:

- `enrollment_terms`
- `invoices`
- `payments`

Do not overload Registration or Class with financial state.

## 6. Business invariants

### Session entitlement

For a session-based term:

```text
consumed = PRESENT + ABSENT (+ policy-defined LATE)
remaining = planned_sessions - consumed
```

`EXCUSED` does not consume entitlement.

### Whole-class cancellation

```text
ClassSession.status = CANCELLED
```

A makeup session may reference the original session.

### Student leave

```text
EnrollmentSession.status = EXCUSED
```

Only that student's entitlement is preserved.

### Makeup

Whole-class:

```text
ClassSession.original_session_id
```

Student-specific:

```text
EnrollmentSession.makeup_for_id
```

### Schedule immutability for one-off exceptions

A makeup, holiday, room change, time change or online exception must not rewrite the recurring schedule.

## 7. Today dashboard data source

The reception dashboard must query:

```text
ClassSession(date = today)
```

and then resolve:

```text
Class
Instructor
Room / Delivery Mode
EnrollmentSession
Student
EnrollmentTerm
Invoice
```

It must not generate today's attendance UI directly from `src/data/schedule.js`.

## 8. Migration safety rules

- No destructive rename of Registration into Enrollment.
- No deletion of `registrations.term`.
- No fabricated historical sessions.
- No fabricated historical attendance.
- Preserve existing public Course/Instructor IDs.
- Preserve certificate and contract relationships.
- Preserve active class/student uniqueness.
- Use additive migrations wherever possible.
- Backfill only from authoritative data that actually exists.
- Every migration must have rollback/compatibility reasoning documented.

## 9. Immediate conclusion

The current repository is ready for the operational domain expansion, but it is **not correct to implement the Today dashboard or session-count logic directly on the current Class/Schedule tables**.

The next implementation unit should be the operational scheduling foundation (`ClassSchedule` + `ClassSession` + `Room`) followed by EnrollmentSession/Attendance. Finance should then attach to EnrollmentTerm rather than being embedded in Registration.
