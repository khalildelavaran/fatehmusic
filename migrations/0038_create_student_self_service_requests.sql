-- ====================================================================
-- Migration 0037: student self-service requests (new course, term renewal)
--
-- Two lightweight request tables, both admin-reviewed rather than
-- self-service enrollment, consistent with the project's existing
-- Registration -> Approval -> Student -> Contract -> Enrollment flow
-- (see CLAUDE.md) and mirroring the makeup_requests pattern (0036):
-- a student submits a request from their dashboard; an admin reviews
-- and, if approved, performs the actual enrollment/term creation
-- through the existing admin tools.
--
-- new_course_requests: a student asking to enroll in an *additional*
-- course (course_id references src/data/courses.js's static id-space,
-- the same convention classes.course_id already uses -- see the header
-- note in migration 0021_create_classes.sql -- so no FK constraint).
--
-- term_renewal_requests: a student asking to continue in their
-- *existing* class for the next term, optionally with a different
-- instructor if the class has more than one available.
-- ====================================================================

CREATE TABLE IF NOT EXISTS new_course_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id         INTEGER NOT NULL,
  instructor_id     INTEGER REFERENCES instructors(id),
  preferred_day     TEXT NOT NULL DEFAULT '',
  note              TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_id    INTEGER,
  review_note       TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS term_renewal_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id     INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  instructor_id     INTEGER REFERENCES instructors(id),
  note              TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_id    INTEGER,
  review_note       TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_new_course_requests_student ON new_course_requests(student_id, status);
CREATE INDEX IF NOT EXISTS idx_new_course_requests_status ON new_course_requests(status);

CREATE INDEX IF NOT EXISTS idx_term_renewal_requests_enrollment ON term_renewal_requests(enrollment_id, status);
CREATE INDEX IF NOT EXISTS idx_term_renewal_requests_student ON term_renewal_requests(student_id, status);
CREATE INDEX IF NOT EXISTS idx_term_renewal_requests_status ON term_renewal_requests(status);

-- One open (pending) request per student per course, and one open
-- request per enrollment for renewal, to avoid duplicate spam requests
-- piling up while a prior one is still awaiting review.
CREATE UNIQUE INDEX IF NOT EXISTS idx_new_course_requests_one_open
  ON new_course_requests(student_id, course_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_term_renewal_requests_one_open
  ON term_renewal_requests(enrollment_id)
  WHERE status = 'pending';
