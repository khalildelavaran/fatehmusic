# ADR-012 — School Scheduling and Enrollment Domain

## Status

Accepted

## Context

The school-management planning document predates the detailed domain decisions for recurring schedules, real sessions, student-specific cycles, leave, makeup sessions, online delivery, and workshops.

## Decisions

### 1. Schedule and Session are different

`ClassSchedule` is the recurring/default timetable. `ClassSession` is the actual dated occurrence. A session may override date, time, instructor, room, or delivery mode without changing the recurring schedule.

### 2. Student cycles are enrollment-scoped

The academy does not require a universal calendar-season term. A student's cycle starts from the first applicable session and may be 4, 8, 10, or another configured number of sessions. Therefore `EnrollmentTerm` belongs to `Enrollment` and is optional.

### 3. Billing is independent from instructional cycle semantics

Support both session-based and monthly billing. The existing finance vocabulary is `Invoice` and `Payment`; do not introduce a parallel `Tuition` aggregate.

### 4. Leave and absence are different

`PRESENT` and `ABSENT` consume a session entitlement. `EXCUSED` (approved leave) does not consume it. Whole-class cancellation is a `ClassSession` concern and is not represented as student leave.

### 5. Makeup sessions are one-off occurrences

A makeup may happen earlier or later than the normal schedule and may use another time, room, and, where policy permits, instructor. It must not mutate the recurring schedule.

### 6. Online and hybrid are delivery modes

Online is not a separate academic hierarchy. A regular class can have an exceptional online session. Hybrid can be represented at session/student attendance level where needed.

### 7. Workshop reuses the same infrastructure

A workshop is a `Class`/offering type using the existing session, enrollment, attendance, and finance infrastructure. It may have one or multiple sessions and no recurring schedule.

## Compatibility with existing documentation

The existing `SCHOOL-MANAGEMENT-IMPLEMENTATION.md` mentions class types including `online` and `workshop` and a generic `Attendance` model. Those descriptions remain compatible as legacy/product terminology, but implementation must follow this ADR and the canonical `music-school-domain` skill: online is a delivery mode, workshop is an offering type, and attendance is represented per enrollment/session for students.

Existing entities must be extended rather than duplicated. In particular, use `Instructor`, `Invoice`, and `Payment` already defined by the project.

## Consequences

This model supports weekly classes, individual lessons, workshops, monthly billing, 4/8/10-session cycles, official-holiday cancellation, student leave, student-specific makeup, whole-class makeup, room changes, and online/hybrid sessions without creating parallel systems.