# Operational Domain Alignment

**Status:** Implemented / canonical

**Repository:** `khalildelavaran/fatehmusic`

## Canonical model

The operational school-management model is now explicitly separated from historical registration data.

```text
Course (static catalog + overrides)
  |
Class
  |-- Room / default delivery settings
  |-- ClassSchedule      recurring plan only
  `-- ClassSession       real calendar occurrence / operational truth
         |-- TeacherSessionAttendance
         `-- EnrollmentSession
                |
Enrollment -----+----- Student
  |
EnrollmentTerm
  |-- ClassTermSettings copied as a snapshot when the term starts
  `-- Invoice
        `-- Payment
```

## Source-of-truth rules

### Registration vs Enrollment

`registrations` remains intake/history. `enrollments` represents current membership in a concrete Class. Legacy `registrations.term` must never drive remaining-session calculations.

### Schedule vs Session

`class_schedules` is the recurring/default plan. `class_sessions` is authoritative for the actual date, time, instructor, room, delivery mode, cancellation and makeup relationship.

A one-off change never rewrites the recurring schedule.

### Term

An `EnrollmentTerm` belongs to one Enrollment and starts from the first concrete ClassSession provisioned for that student in the cycle. A term may be session-based (4/8/10/etc.) or monthly.

`class_term_settings` is the single source for class-level billing/term defaults. Values are copied into `enrollment_terms` as a historical snapshot.

### Attendance

Student attendance states:

```text
pending  = not recorded yet (yellow)
present  = present (green, consumes a session)
absent   = absent (red, consumes a session)
excused  = approved leave (white, does not consume a session)
```

Teacher attendance states:

```text
pending
present
absent
```

### Makeup

Whole-class makeup uses `class_sessions.original_session_id`.

Student-specific makeup uses `enrollment_sessions.makeup_for_id`.

The database verifies that a makeup source exists and belongs to the same Class/Enrollment.

### Holidays

`calendar_exceptions` is advisory. An official holiday does not automatically cancel a ClassSession. The Session record remains authoritative, so a class may intentionally run on a holiday.

### Billing

`enrollment_terms` stores the tuition snapshot and due date. `invoices` represents the actual obligation and `payments` settlement. Term creation idempotently ensures the tuition invoice when an amount exists.

## Database invariants

The canonical migration chain enforces:

- one active Enrollment per student/class;
- one active EnrollmentTerm per Enrollment;
- one EnrollmentSession per Enrollment/ClassSession;
- EnrollmentSession and EnrollmentTerm must belong to the same Enrollment;
- Enrollment and ClassSession must belong to the same Class;
- attendance cannot be recorded against a cancelled Session;
- teacher attendance must match the instructor assigned to the Session;
- makeup records must reference valid same-domain source records;
- pending is distinct from absence for both student and teacher attendance.

## Canonical migration sequence

The operational chain is:

```text
0022_operational_education_domain.sql
0023_refine_enrollment_terms.sql
0024_refine_calendar_exceptions.sql
0025_bind_enrollment_sessions_to_terms.sql
0026_attendance_pending_status.sql
0027_enrollment_term_integrity.sql
0028_session_provisioning_integrity.sql
0029_class_term_settings.sql
0030_unify_operational_domain_integrity.sql
```

Duplicate historical implementations with incompatible column vocabulary were removed from the canonical chain.

## Daily dashboard

The reception dashboard is derived from `ClassSession(date)` and joins Class, Instructor, Room, TeacherAttendance, EnrollmentSession, Student, EnrollmentTerm and Invoice.

It therefore correctly reflects one-off room/time changes, online/hybrid sessions, makeup sessions and holidays without mutating the recurring schedule.
