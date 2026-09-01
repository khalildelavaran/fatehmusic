# Fateh Music Academy — Claude Code Instructions

## Repository rules

Read `AGENTS.md` first. Then read the project context documents required by `AGENTS.md` before changing code.

Also read `.agents/skills/music-school-domain/SKILL.md` for any school-management domain change.

## Domain precedence

For the school-management domain, the canonical detailed rules are in:

`.agents/skills/music-school-domain/SKILL.md`

The skill resolves ambiguities in older planning documents without redesigning the public website/SEO architecture.

Important current domain decisions:

- `Instructor` is the canonical code term; do not introduce `Teacher` as a new aggregate.
- `Course` and `Class` are separate.
- `ClassSchedule` is the recurring/default plan; `ClassSession` is the real dated occurrence.
- Session date/time/instructor/room/delivery mode may override the recurring schedule.
- Student membership is `Enrollment`.
- A student's instructional cycle is `EnrollmentTerm`, scoped to the enrollment and optional for workshops/monthly models.
- `Invoice` and `Payment` are the canonical finance concepts; do not create a duplicate `Tuition` aggregate.
- Student attendance is per enrollment/session. `PRESENT` and `ABSENT` consume session entitlement; `EXCUSED` does not.
- Whole-class cancellation and student leave are different operations.
- Makeup sessions may occur on another date/time/room and must not mutate the recurring schedule.
- Online and hybrid are delivery modes, not separate academic hierarchies.
- Workshops reuse Class/Session/Enrollment/Attendance/Finance infrastructure and may have no recurring schedule.

## Compatibility

Before implementing these rules, inspect the existing schema, migrations, APIs, and UI. Extend existing models rather than creating duplicates. If an older document or implementation uses a conflicting name or shape, preserve backward compatibility where necessary and document/migrate the model instead of silently maintaining two competing concepts.

## Validation

Before committing applicable code, follow `CONTRIBUTING.md` and run the repository's required checks, including `astro check` and `npm run build` when applicable.
