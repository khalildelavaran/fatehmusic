# Music School Domain Model

## Aggregate map

```text
Branch
  └── Room

Course
  └── Class
       ├── ClassSchedule (optional for one-off workshops)
       └── ClassSession
            ├── InstructorSessionAttendance
            └── EnrollmentSession

Student
  └── Enrollment
       ├── Class
       └── EnrollmentTerm (optional)
            └── Invoice
                 └── Payment
```

## Responsibilities

| Entity | Responsibility |
|---|---|
| Course | Educational subject/product |
| Class | Concrete offering of a course |
| ClassSchedule | Recurring/default timetable |
| ClassSession | Real dated occurrence |
| Enrollment | Student's membership in a class |
| EnrollmentTerm | Student-specific instructional/billing cycle |
| EnrollmentSession | Student status for one occurrence |
| Invoice | Amount owed |
| Payment | Amount paid |
| Room | Physical branch resource |

## Important relationships

- `Class.course_id -> Course`
- `ClassSchedule.class_id -> Class`
- `ClassSession.class_id -> Class`
- `Enrollment.student_id -> Student`
- `Enrollment.class_id -> Class`
- `EnrollmentTerm.enrollment_id -> Enrollment`
- `EnrollmentSession.enrollment_id -> Enrollment`
- `EnrollmentSession.session_id -> ClassSession`
- `Invoice` should use the repository's existing finance relationships.

## Makeup relationships

Whole-class makeup:

```text
replacement ClassSession.original_session_id -> cancelled/original ClassSession
```

Student-specific makeup:

```text
replacement EnrollmentSession.makeup_for_id -> excused/original EnrollmentSession
```

## Important invariants

- No duplicate active enrollment for the same student/class.
- No duplicate attendance/EnrollmentSession for the same enrollment/session.
- Schedule conflicts for instructor and room must be checked server-side.
- Session-level room/instructor may differ from schedule defaults.
- Session date/time is authoritative for the occurrence.
- `EXCUSED` does not consume a session entitlement.
- `PRESENT` and `ABSENT` consume entitlement.
