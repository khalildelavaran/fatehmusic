-- ====================================================================
-- Migration 0021: classes + class_students (Phase 3 — Classes,
-- bundled with Phase 4 — Class Students, the same way Phase 2 bundled
-- in Section 8's relationship: an empty Classes feature with no way
-- to see who's enrolled isn't a usable admin deliverable on its own).
--
-- Course = what is taught, Class = who/with which instructor/when
-- (Section 9's own distinction). Course already exists as the static
-- src/data/courses.js catalog + course_overrides (migration 0013) for
-- admin edits -- registrations.instrument_id has always pointed into
-- that same id-space. classes.course_id reuses it (no FK constraint,
-- same as instrument_id/instructor_id on registrations -- it's a
-- reference into the static catalog's ids, not another D1 table).
--
-- instructor_id DOES reference a real table: instructors (migration
-- 0012). student_id in class_students references students (migration
-- 0011).
--
-- This is a forward-looking operational layer, not backfilled from
-- registrations: a registration records "signed up for guitar with
-- instructor X on Mondays" but not which specific class group (if
-- more than one runs at that slot) -- that's an admin decision, not
-- something to guess/fabricate from existing data. classes and
-- class_students both start empty and are populated by admin action
-- going forward.
-- ====================================================================

CREATE TABLE IF NOT EXISTS classes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  course_id      INTEGER NOT NULL,   -- src/data/courses.js id-space (see header)
  instructor_id  INTEGER NOT NULL REFERENCES instructors(id),

  room           TEXT NOT NULL DEFAULT '',
  class_type     TEXT NOT NULL DEFAULT 'individual', -- individual | group | workshop | online
  capacity       INTEGER NOT NULL DEFAULT 1,
  level          TEXT NOT NULL DEFAULT '',

  start_date     TEXT,
  end_date       TEXT,
  status         TEXT NOT NULL DEFAULT 'active', -- active | completed | cancelled
  notes          TEXT NOT NULL DEFAULT '',

  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_classes_instructor ON classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON classes(status);
CREATE INDEX IF NOT EXISTS idx_classes_course ON classes(course_id);

CREATE TABLE IF NOT EXISTS class_students (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id         INTEGER NOT NULL REFERENCES classes(id),
  student_id       INTEGER NOT NULL REFERENCES students(id),
  enrollment_date  TEXT NOT NULL DEFAULT (datetime('now')),
  status           TEXT NOT NULL DEFAULT 'active', -- active | completed | withdrawn
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);

-- Section 10: "a Student must not be enrolled twice in the same
-- active Class" -- enforced as a DB-level constraint (partial unique
-- index over active rows only), not just an application check, so it
-- holds even under concurrent requests. A student CAN be re-enrolled
-- later if an earlier enrollment was withdrawn/completed, since those
-- rows fall outside this partial index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_students_one_active
  ON class_students(class_id, student_id)
  WHERE status = 'active';
