# Operational education domain reconciliation

## Canonical model

`ClassSchedule` is the recurring plan. `ClassSession` is the concrete operational source of truth. Student participation is recorded in `EnrollmentSession`; teacher attendance is recorded in `TeacherSessionAttendance`.

`EnrollmentTerm` snapshots the class-level term policy at the student's first concrete session. A later class policy change must not rewrite an existing term.

## Attendance semantics

- Student: `pending`, `present`, `absent`, `excused`.
- Teacher: `pending`, `present`, `absent`.
- `present` and `absent` consume a session; `excused` does not.
- A cancelled class session cannot receive recorded student attendance.

## Makeup semantics

A makeup is a new concrete `ClassSession` with `type = 'makeup'` and a valid `original_session_id` from the same class. A student's makeup participation references the original `EnrollmentSession` through `makeup_for_id` and must belong to the same enrollment.

## Calendar semantics

Calendar exceptions are advisory. A holiday does not cancel a class automatically. If a class is not held, the concrete `ClassSession.status` is explicitly changed to `cancelled`.

## Migration safety

The reconciliation uses forward-only migrations (`0031` onward). Existing migration numbers are not rewritten, because already-applied D1 migrations must not be mutated in place.
