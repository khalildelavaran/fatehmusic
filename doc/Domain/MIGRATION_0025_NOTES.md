# Migration 0025 Notes

`enrollment_sessions.enrollment_term_id` is nullable for backward compatibility. Existing attendance/session links can therefore be migrated before assigning a term.

New application code must populate `enrollment_term_id` whenever an EnrollmentTerm exists.

Do not infer a historical term from `registrations.term`; that field remains legacy registration history.

Term-based session consumption is calculated only from sessions linked to the selected EnrollmentTerm and non-cancelled ClassSessions.
