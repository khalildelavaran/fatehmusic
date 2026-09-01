# DATA_MODEL.md

**Version:** 2.0

**Status:** Approved — operational domain amendment

**Architecture Level:** Enterprise

**Project:** Fateh Music Academy

> This document remains the canonical domain reference. The operational amendment at the end of the document supersedes any earlier statement that conflicts with it.

---

# 1. Purpose

This document defines the business domain model of the Fateh Music Academy platform.

The Domain Model is independent from Astro, JavaScript, databases, CMS and APIs. It represents the business itself.

---

# 2. Design Principles

The data model follows Domain Driven Design (DDD), Entity-Centric Architecture, Repository Pattern, AI-First Design and Schema.org compatibility.

Every object represents a real-world business concept.

---

# 3. Public/content domain

The existing public/content entities remain valid:

```text
Organization
Course
Instructor
Article
Category
MusicStyle
Instrument
Gallery
GalleryImage
Review
FAQ
Branch
SocialProfile
Event
```

The public Course catalog continues to use the existing static catalog plus operational overrides. The operational school-management model must not duplicate these public identities.

---

# 4. Operational school domain

The operational domain is:

```text
Course
  ↓
Class
  ├── ClassSchedule (recurring/default plan)
  └── ClassSession (real calendar occurrence)
          ├── InstructorSessionAttendance
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

---

# 5. Course

`Course` represents what is taught.

It is not a particular student's schedule and does not own a specific calendar occurrence.

---

# 6. Class

`Class` represents an operational teaching offering based on a Course.

The current D1 `classes` table is the existing implementation and must be extended rather than duplicated.

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

The current `class_type = online` value is a legacy mismatch and must be migrated semantically to `delivery_mode = ONLINE`.

---

# 7. ClassSchedule

`ClassSchedule` is a recurring/default timetable.

It answers:

> معمولاً کلاس چه روز و ساعتی برگزار می‌شود؟

It is not the actual attendance event.

A future operational schedule should contain at least:

```text
classId
weekday
startTime
endTime
roomId
validFrom
validTo
```

The existing `src/data/schedule.js` is a legacy static catalog and is not itself the authoritative operational Schedule table.

---

# 8. ClassSession

`ClassSession` represents one real calendar occurrence.

It owns the effective date/time/location for that occurrence and can differ from the recurring Schedule.

Conceptual properties:

```text
id
classId
date
startTime
endTime
instructorId
roomId
deliveryMode
type
status
originalSessionId
cancellationReason
notes
```

Session type may include:

```text
REGULAR
MAKEUP
```

Status may include:

```text
SCHEDULED
COMPLETED
CANCELLED
```

A Session may exist without a recurring Schedule, especially for workshops and makeup sessions.

---

# 9. Room

`Room` is a physical resource belonging to a Branch.

The current `classes.room` text field is a legacy representation. The target operational model uses a real Room resource and stores the actual room on Session.

A Session room may differ from the default Schedule room.

---

# 10. Student

`Student` is the person-level entity.

The existing D1 `students` table is authoritative for operational student identity.

---

# 11. Registration

`Registration` represents intake/history from the registration process.

It is not the same concept as Enrollment.

Existing registrations must remain backward-compatible.

---

# 12. Enrollment

`Enrollment` represents a student's active membership in a Class.

The current `class_students` table is the existing operational predecessor and must be evolved rather than duplicated without an explicit migration strategy.

An active student/Class relationship must be unique.

---

# 13. EnrollmentTerm

`EnrollmentTerm` represents one student's instructional/billing cycle.

It is scoped to an Enrollment.

A term is not a calendar season and is not globally defined by Course.

For session-based education, it begins from the student's first applicable instructional session and may contain:

```text
4 sessions
8 sessions
10 sessions
```

or another configured entitlement.

The effective count belongs to the EnrollmentTerm.

---

# 14. Legacy Registration.term

The existing `registrations.term` field numbers registrations for a student.

This is retained as legacy registration history.

It must not be used as the authoritative instructional `EnrollmentTerm` after the operational model is introduced.

No destructive rename is permitted.

---

# 15. EnrollmentSession

`EnrollmentSession` represents one student's relationship to one ClassSession.

Conceptual properties:

```text
id
enrollmentId
sessionId
status
attendanceMode
note
makeupForId
```

Canonical student status:

```text
PRESENT
ABSENT
EXCUSED
```

`EXCUSED` means approved leave and does not consume the student's session entitlement.

`PRESENT` and `ABSENT` consume entitlement.

If `LATE` is introduced, its consumption semantics must be explicitly defined by academy policy.

---

# 16. InstructorSessionAttendance

Instructor attendance is independent of student attendance.

It must not be inferred from student attendance or ClassSession status.

---

# 17. Makeup sessions

Two cases exist.

### Whole-class makeup

A replacement ClassSession references the original session:

```text
ClassSession.originalSessionId
```

### Student-specific makeup

A replacement EnrollmentSession references the original excused record:

```text
EnrollmentSession.makeupForId
```

A makeup may occur earlier or later than the normal schedule and may use a different date, time, room, delivery mode and, where academy policy permits, instructor.

The recurring Schedule must never be rewritten to represent a one-off makeup.

---

# 18. Holidays and cancellation

An official holiday does not delete or rewrite recurring Schedule data.

A generated ClassSession may be marked:

```text
CANCELLED
```

with:

```text
cancellationReason = OFFICIAL_HOLIDAY
```

A replacement makeup session is created only when the academy requires one.

---

# 19. Workshop

A Workshop reuses the Class/Session/Enrollment infrastructure.

```text
Class.type = WORKSHOP
```

A workshop may have one or multiple Sessions and does not require a recurring ClassSchedule.

A workshop Enrollment does not necessarily require EnrollmentTerm.

---

# 20. Delivery modes

Online is not a separate academic hierarchy.

A Class may have a default delivery mode, while a particular Session may override it.

A Hybrid Session may contain students with different attendance modes:

```text
Student A → PRESENT / IN_PERSON
Student B → PRESENT / ONLINE
Student C → EXCUSED
```

---

# 21. Billing

Billing is independent of scheduling.

Supported models:

```text
SESSION_BASED
MONTHLY
```

A session-based cycle has a planned session entitlement.

A monthly billing cycle is based on the billing period and does not automatically imply a fixed number of sessions.

---

# 22. Invoice

`Invoice` represents a tuition/debt charge.

It must remain separate from ClassSession and EnrollmentSession.

---

# 23. Payment

`Payment` represents money paid against an Invoice.

It must not be used to calculate instructional attendance directly.

---

# 24. Session entitlement calculation

For a session-based EnrollmentTerm:

```text
consumed = PRESENT + ABSENT (+ policy-defined LATE)
remaining = plannedSessions - consumed
```

`EXCUSED` does not consume entitlement.

`remainingSessions` is derived data, not an independently editable source of truth.

---

# 25. Today dashboard

The reception/admin dashboard must use:

```text
ClassSession(date = today)
```

as its operational source.

It must not derive today's real attendance schedule directly from `src/data/schedule.js`.

For each Session it should resolve:

```text
Class
Course
Instructor
Room / DeliveryMode
InstructorAttendance
EnrollmentSession
Student
EnrollmentTerm
Invoice
```

Student attendance actions:

```text
PRESENT → green
ABSENT  → red
EXCUSED → white
```

Attendance colors must not be reused for financial state.

---

# 26. Current implementation mapping

| Current | Domain meaning | Decision |
|---|---|---|
| `src/data/courses.js` | Course catalog | Preserve |
| `course_overrides` | Course admin override | Preserve |
| `instructors` | Instructor | Preserve |
| `students` | Student | Preserve |
| `registrations` | Registration/intake history | Preserve |
| `registrations.term` | Legacy registration numbering | Preserve; not new Term authority |
| `classes` | Class | Extend |
| `class_students` | Enrollment predecessor | Evolve |
| `src/data/schedule.js` | Legacy schedule catalog | Do not use as real Session source |
| `classes.room` | Legacy room label | Migrate/augment with Room |
| `classes.class_type=online` | Mixed semantic field | Migrate to delivery mode |
| missing ClassSession | Real session | Add |
| missing EnrollmentSession | Student/session state | Add |
| missing InstructorSessionAttendance | Instructor attendance | Add |
| missing Room | Physical resource | Add |
| missing Invoice | Tuition charge | Add |
| missing Payment | Payment | Add |

---

# 27. Architectural rule

**Schedule is a plan. Session is reality. Enrollment is membership. EnrollmentSession is the student's state in reality. EnrollmentTerm is the student's instructional/billing cycle. Invoice and Payment are finance.**

These concepts must not be collapsed into one table or one overloaded field.

---

# 28. Compatibility

The operational domain must preserve:

- existing Student IDs
- existing Instructor IDs
- existing Course IDs/slugs
- existing Registration history
- existing Contract relationships
- existing Certificate relationships
- public SEO/content architecture

No historical attendance or historical session times may be fabricated when migrating from the current static schedule.

---

# 29. Status

Approved

Mandatory

Effective immediately for new operational development.
