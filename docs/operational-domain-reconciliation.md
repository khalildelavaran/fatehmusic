# Operational education domain reconciliation

## Canonical model

`ClassSchedule` is the recurring plan. `ClassSession` is the concrete operational source of truth. Student participation is recorded in `EnrollmentSession`; teacher attendance is recorded in `TeacherSessionAttendance`.

`EnrollmentTerm` snapshots the class-level term settings at the student's first concrete session. A later class settings change must not rewrite an existing term.

## Attendance semantics

- Student: `pending`, `present`, `absent`, `excused`.
- Teacher: `pending`, `present`, `absent`.
- `present` and `absent` consume a session; `excused` does not.
- A cancelled class session never consumes a student term session.
- Attendance remains recordable when billing/term configuration is temporarily incomplete; the nullable `enrollment_term_id` can be bound later.
- The canonical teacher identity column is `teacher_session_attendance.instructor_id` and `check_in_at` is preserved.

## Makeup semantics

A makeup is a new concrete `ClassSession` with `type = 'makeup'` and a valid `original_session_id` from the same class.

A student's makeup participation references the original `EnrollmentSession` through `makeup_for_id`, belongs to the same enrollment and term, and can only replace an `excused` occurrence. Only one student makeup may exist for one original occurrence. Once that makeup exists, the original excused occurrence is locked so both occurrences cannot be consumed.

## Calendar semantics

Calendar exceptions are advisory. A holiday does not cancel a class automatically. If a class is not held, the concrete `ClassSession.status` is explicitly changed to `cancelled`.

## Enrollment compatibility

Legacy active `class_students` memberships are normalized into `enrollments` on demand during session provisioning. This keeps existing Class Management data visible in operational attendance without requiring a destructive data migration.

## Migration safety

Remote D1 was previously only migrated through the pre-operational chain. Reconciliation therefore consolidates the not-yet-remote operational sequence as one file per migration number from `0022` through `0030`, with `0030_unify_operational_domain_integrity.sql` owning the final integrity triggers and teacher-attendance rebuild.

Do not apply the remote operational migrations until the full chain succeeds against a fresh local D1 database.
