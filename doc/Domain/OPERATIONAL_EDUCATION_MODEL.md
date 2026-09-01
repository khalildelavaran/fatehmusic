# Operational Education Domain Model

**Status:** Approved for implementation
**Migration:** `0022_create_operational_education_domain.sql`

This document refines the permanent domain model for the operational side of Fateh Music Academy. It complements `doc/Domain/DATA_MODEL.md` and does not replace the content/catalog architecture.

## 1. Existing model that must remain

- `Course` remains the static `src/data/courses.js` catalog plus `course_overrides`.
- `Instructor` is the relational `instructors` entity.
- `Student` is the relational `students` entity.
- `registrations` remains the public registration/history boundary.
- `class_students` remains for backward compatibility with the existing Classes feature.

Do not fabricate historical Class, Session, or Attendance records from public registrations.

## 2. Operational model

```text
Course
  |
  v
Class
  |
  +--> ClassSchedule       recurring plan
  |
  +--> ClassSession        real calendar occurrence
            |
            +--> TeacherSessionAttendance
            |
            +--> EnrollmentSession
                     |
                     v
                 Enrollment
                  /       \
                 /         +--> Student
                v
          EnrollmentTerm
                |
                v
             Invoice
                |
                v
             Payment
```

## 3. Course vs Class

`Course` answers **what is taught**.

`Class` answers **which operational offering is running**, with an instructor, branch/context, capacity and lifecycle.

A Class references the Course catalog ID but must not create a duplicate relational Course table.

## 4. Class type vs delivery mode

These are separate concepts.

```text
class_type:
  individual
  group
  workshop

delivery_mode:
  in_person
  online
  hybrid
```

Legacy `classes.class_type = online` is normalized by migration 0022 to:

```text
class_type = individual
delivery_mode = online
```

This is a compatibility migration, not a claim that every old online class was truly individual; it prevents `online` from remaining a mixed semantic field.

## 5. Schedule vs Session

### ClassSchedule

A recurring/default plan:

- weekday
- start time
- end time
- default room
- default teacher
- effective date range

### ClassSession

A concrete calendar occurrence. It owns the actual date/time, teacher, room and delivery mode for that occurrence.

A Session may differ from its Schedule without mutating the Schedule.

Examples:

- official holiday -> Session cancelled
- makeup -> new Session on another day/time
- room unavailable -> Session uses another room
- teacher substitution -> Session uses another teacher
- one session online -> Session delivery mode becomes online

## 6. Iranian week convention

`class_schedules.weekday` uses:

```text
0 = Saturday
1 = Sunday
2 = Monday
3 = Tuesday
4 = Wednesday
5 = Thursday
6 = Friday
```

This is an internal canonical value. UI may display Persian weekday names.

## 7. Enrollment

`Enrollment` is the operational relationship between a Student and a Class.

`class_students` is not the long-term domain model; it is a compatibility boundary during migration from the existing Class Management feature.

New business logic should use `enrollments`.

## 8. Term / educational cycle

A Term is **not a calendar quarter** and is not the same thing as the historical `registrations.term` field.

A Term belongs to an Enrollment.

The first term starts from the student's first actual educational session in that cycle. The number of sessions is configurable per enrollment term.

Examples:

```text
Piano  -> 10 sessions
Guitar -> 8 sessions
Theory -> 4 sessions
```

Monthly billing is also supported:

```text
billing_type = monthly
```

Therefore `planned_sessions` is nullable.

The historical `registrations.term` value must not be reused as the operational Term number.

## 9. Attendance semantics

`EnrollmentSession.attendance_status`:

```text
pending
present
absent
excused
```

Consumption rule:

```text
present -> consumes one session
absent  -> consumes one session
excused -> does NOT consume one session
pending -> does not count until resolved
```

This rule is a core business invariant and must be implemented in the domain/service layer, not only in UI code.

## 10. Makeup sessions

There are two different cases.

### Whole-class makeup

A cancelled ClassSession can have a replacement ClassSession:

```text
replacement.original_session_id = cancelled.id
replacement.type = makeup
```

### Individual student makeup

An EXCUSED EnrollmentSession can be satisfied by a later EnrollmentSession:

```text
makeup.makeup_for_enrollment_id = excused.id
```

The individual makeup may occur at a different date/time and can be a different Session from the student's normal Schedule.

## 11. Official holidays

`calendar_exceptions` stores official holidays and academy closures.

A calendar exception must **not** automatically delete or move a Session.

The operational workflow is:

1. detect exception
2. identify affected Sessions
3. cancel/mark the affected Session
4. create a makeup Session when appropriate
5. preserve the original Session for audit/history

## 12. Rooms

`rooms` is the physical resource catalog.

The normal room may be defined on Schedule/Class, while the actual room belongs to Session.

A Session may have `room_id = NULL` when it is online.

## 13. Online / hybrid sessions

A Class may have a default delivery mode, but Session is authoritative for the actual occurrence.

A Hybrid Session can contain students with different `attendance_mode` values:

```text
Student A -> present / in_person
Student B -> present / online
Student C -> excused
```

## 14. Billing

Billing is deliberately separated from Term.

```text
EnrollmentTerm -> Invoice -> Payment
```

`Invoice` is the financial obligation.

`Payment` is a settlement against an invoice.

Do not use `tuition_amount` on the Term as the sole source of financial truth once invoices exist; it is an optional planning/snapshot field.

## 15. Daily secretary dashboard

The daily dashboard must be driven by `class_sessions`, not by the static Schedule.

Query flow:

```text
Today
  -> ClassSession
  -> Class / Instructor / Room
  -> EnrollmentSession
  -> Student
  -> current EnrollmentTerm
  -> invoice status
```

The UI should expose:

- teacher attendance
- student attendance
- present = green
- absent = red
- excused = white
- sessions completed
- sessions remaining
- tuition due warning
- room / online status
- makeup indicator

## 16. Data integrity rules

1. Never infer Class from a historical registration.
2. Never infer a Session from a Schedule without an explicit scheduling operation.
3. Never treat `registrations.term` as `EnrollmentTerm`.
4. Never mix delivery mode with class type.
5. Never delete a cancelled Session merely because it was replaced by a makeup.
6. Never count EXCUSED as consumed.
7. Never make teacher attendance equal to student attendance.
8. Never mutate a recurring Schedule merely to correct one Session.
9. Do not store `remaining_sessions` as authoritative state; derive it from attendance/session facts.
10. Use database constraints for uniqueness where practical and service-layer validation for cross-aggregate rules.

## 17. Migration strategy

Migration 0022 is additive except for the semantic normalization of legacy `classes.class_type = online`.

It creates:

- `rooms`
- `class_schedules`
- `class_sessions`
- `enrollments`
- `enrollment_terms`
- `enrollment_sessions`
- `teacher_session_attendance`
- `invoices`
- `payments`
- `calendar_exceptions`

It also adds `classes.default_room_id` and `classes.delivery_mode`.

Existing `class_students` rows are copied to `enrollments` when they have not already been migrated.

No registration history is automatically converted into operational enrollment/session history.

## 18. Implementation order

```text
Phase A: Migration + domain types
Phase B: Schedule CRUD
Phase C: Session generation / manual session creation
Phase D: Enrollment + Term
Phase E: Daily attendance dashboard
Phase F: Makeup + holiday workflows
Phase G: Invoice + Payment
Phase H: reporting / audit
```

The daily dashboard should not be implemented before Session and EnrollmentSession are operational.
