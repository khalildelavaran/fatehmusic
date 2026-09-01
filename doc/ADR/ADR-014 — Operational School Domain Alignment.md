# ADR-014 — Operational School Domain Alignment

**Status:** Accepted

**Date:** 2026-09-01

## Context

The school-management implementation introduced operational `classes` and `class_students` tables while the public Course/Instructor catalog remains partly static. New business requirements now require real sessions, student-specific terms, leave, absence, makeup sessions, room resources, instructor attendance, workshops, and daily reception operations.

The current repository therefore needs an explicit boundary between legacy/current storage and the target operational domain.

## Decision

Adopt the following canonical operational model:

```text
Course
  ↓
Class
  ├── ClassSchedule
  └── ClassSession
          ├── InstructorSessionAttendance
          └── EnrollmentSession
                    ↓
                Enrollment
                 ├── Student
                 └── EnrollmentTerm
                            ↓
                         Invoice
                            ↓
                         Payment
```

### Course

Remains the educational catalog entity. The existing static `src/data/courses.js` plus `course_overrides` architecture remains authoritative for the public course catalog.

### Class

Remains the operational teaching offering. The existing `classes` table is extended rather than duplicated.

### ClassSchedule

Represents recurring/default scheduling. It is not a real attendance event.

### ClassSession

Represents one real calendar occurrence and is authoritative for its actual date, time, instructor, room and delivery mode.

### Enrollment

The existing `class_students` relationship is the predecessor of Enrollment. It must be evolved without creating a competing duplicate relationship.

### EnrollmentTerm

Is scoped to an Enrollment. It is not the same thing as legacy `registrations.term`.

A session-based term starts from the student's first applicable instructional session and may contain 4, 8, 10 or another configured number of sessions.

Monthly billing is supported independently of session count.

### Attendance

Student attendance is per Enrollment + Session.

- `PRESENT` consumes entitlement.
- `ABSENT` consumes entitlement.
- `EXCUSED` does not consume entitlement.

Instructor attendance is independent.

### Makeup

Whole-class makeup is represented by a replacement ClassSession referencing the original session.

Student-specific makeup is represented by an EnrollmentSession referencing the original excused EnrollmentSession.

### Delivery mode

Class type and delivery mode are separate dimensions.

Class type:

```text
INDIVIDUAL
GROUP
WORKSHOP
```

Delivery mode:

```text
IN_PERSON
ONLINE
HYBRID
```

The existing `classes.class_type = online` value is treated as a legacy semantic mismatch to be migrated, not propagated.

### Room

The existing `classes.room` text field is legacy. The target model introduces a reusable Room resource and stores the actual Session room separately from the default schedule room.

## Consequences

Positive:

- Real daily scheduling becomes possible.
- Holiday and makeup handling does not corrupt recurring schedules.
- Student leave can preserve entitlement.
- Remaining sessions can be calculated from authoritative records.
- Workshops reuse the same operational infrastructure.
- Online/hybrid delivery is supported without a second class hierarchy.
- Financial records can attach to enrollment terms without abusing Registration.

Negative:

- Several additive migrations are required.
- Legacy schedule/registration data cannot be blindly converted.
- The current `classes` model needs controlled evolution.

## Migration constraints

1. Preserve existing Registration history.
2. Preserve `registrations.term` for backward compatibility.
3. Do not use `registrations.term` as the new instructional-term authority.
4. Do not fabricate historical session times or attendance.
5. Preserve existing Student/Instructor/Course identities.
6. Preserve Contract and Certificate relationships.
7. Use additive migrations where practical.
8. Update API and tests together with each schema change.

## Immediate implementation order

1. `rooms` + `class_schedules` + `class_sessions`
2. Enrollment evolution
3. `enrollment_sessions` / attendance
4. Instructor session attendance
5. `enrollment_terms`
6. `invoices` + `payments`
7. Today dashboard

The Today dashboard must consume real ClassSession records rather than the legacy static schedule catalog.
