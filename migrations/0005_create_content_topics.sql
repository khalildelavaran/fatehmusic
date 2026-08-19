-- ====================================================================
-- Migration 0005: Content Intelligence Engine — topic/title queue
--
-- Feeds the daily article pipeline with scored, deduplicated topic
-- candidates instead of the old random pick in ai-post-generator.ts.
-- See: doc/ADR/ADR-011 — Content Intelligence Engine.md
--
-- Apply locally:  npm run db:migrate:local
-- Apply to prod:   npm run db:migrate:remote
-- ====================================================================

CREATE TABLE IF NOT EXISTS content_topics (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,

  -- The candidate headline itself (Persian) and a normalized form used
  -- for dedup against other candidates and against blog_posts.title.
  title                 TEXT NOT NULL,
  normalized_key        TEXT NOT NULL,

  -- Which course/instrument this strengthens (courses.js is the source
  -- of truth; instrument_key mirrors courses[].instrument). Both may be
  -- NULL for general/evergreen topics not tied to one instrument.
  instrument_key        TEXT,
  related_course_slug   TEXT,
  related_course_title  TEXT,
  category              TEXT,

  -- Optional audience/level narrowing. Empty string means "general/any".
  audience              TEXT NOT NULL DEFAULT '',
  level                 TEXT NOT NULL DEFAULT '',

  -- Which title template family produced this, and its detected search intent.
  modifier_type         TEXT NOT NULL,
  intent                TEXT NOT NULL,

  -- Transparent scoring: total plus a JSON breakdown per factor, and a
  -- short human-readable reason (both shown in the admin UI so a human
  -- can sanity-check the ranking, never just a trust-me black-box number).
  score_total           REAL NOT NULL DEFAULT 0,
  score_breakdown       TEXT,
  reasoning             TEXT,

  status                TEXT NOT NULL DEFAULT 'candidate', -- candidate | approved | rejected | used
  source                TEXT NOT NULL DEFAULT 'seed_generator',

  used_by_post_id       INTEGER,
  run_id                INTEGER,

  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  used_at               TEXT
);

-- Enforces dedup at the database level too (defense in depth on top of
-- the app-level normalize+dedup pass) via INSERT OR IGNORE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_topics_normalized_key ON content_topics(normalized_key);
CREATE INDEX IF NOT EXISTS idx_content_topics_status ON content_topics(status);
CREATE INDEX IF NOT EXISTS idx_content_topics_score ON content_topics(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_content_topics_instrument ON content_topics(instrument_key);

-- Lightweight run history for the admin UI ("last run: 42 candidates,
-- 31 after dedup, 18 approved") -- intentionally not a full job queue,
-- matching the single-function-call simplicity of the existing worker.
CREATE TABLE IF NOT EXISTS content_topic_runs (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at             TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at            TEXT,
  status                 TEXT NOT NULL DEFAULT 'running', -- running | success | failed
  candidates_generated   INTEGER NOT NULL DEFAULT 0,
  candidates_after_dedup INTEGER NOT NULL DEFAULT 0,
  candidates_approved    INTEGER NOT NULL DEFAULT 0,
  error_message          TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_topic_runs_started_at ON content_topic_runs(started_at);
