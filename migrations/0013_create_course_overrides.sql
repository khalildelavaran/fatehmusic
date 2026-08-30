-- Course Management: keep the public static course catalog as the canonical
-- SEO/content source while allowing operational edits from the admin panel.
-- Each row stores a complete JSON override for one existing course.
CREATE TABLE IF NOT EXISTS course_overrides (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_course_overrides_slug ON course_overrides(slug);
