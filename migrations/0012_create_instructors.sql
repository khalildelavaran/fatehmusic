-- ====================================================================
-- Migration 0012: create instructors table (Phase 2 — Instructor Management)
--
-- Context: same situation as students (migration 0011) -- the project
-- had no relational Instructor entity. src/data/instructors.js is a
-- FROZEN static SEO content file (public bio pages), not a database
-- table, so it is left untouched here.
--
-- Deliberate design choice: this table's ids are seeded to match
-- src/data/instructors.js's ids exactly (1-14) on purpose. registrations
-- already has an instructor_id column (migration 0001) that has always
-- stored these exact same ids -- so every existing and future
-- registration is correctly linked to this table with NO migration
-- needed on registrations at all, and zero risk to that table.
--
-- Section 8 (Student <-> Instructor relationship, start_date/end_date/
-- course/status) is intentionally NOT a new junction table: registrations
-- already has one row per student+instructor+course+term (and, as of
-- migration 0011, a student_id column), which already answers "which
-- instructors has this student had, and for which course, and since
-- when" without duplicating that history into a second table. See
-- src/server/instructors.ts (getInstructorProfile) for the query.
--
-- New instructors created later through the admin panel are NOT
-- required to exist in src/data/instructors.js -- the two are related
-- (same ids/slugs for the 14 seeded here) but independent going
-- forward: this table is the operational roster, instructors.js is
-- only the public marketing bio page content.
-- ====================================================================

CREATE TABLE IF NOT EXISTS instructors (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,

  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',

  specialty     TEXT NOT NULL DEFAULT '',   -- e.g. "مدرس گیتار و دروس پایه موسیقی"
  instruments   TEXT NOT NULL DEFAULT '[]', -- JSON array of src/data/courses.js slugs
  biography     TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',   -- internal admin-only notes

  -- Section 7: soft-deactivate only, physical delete is explicitly not
  -- recommended once an instructor has teaching history.
  is_active     INTEGER NOT NULL DEFAULT 1,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_instructors_active ON instructors(is_active);

-- ---------------------------------------------------------------
-- Seed: generated directly from src/data/instructors.js (a small
-- Node script imported the real module and printed these INSERTs) --
-- not hand-typed, so none of the Persian names/bios below is at risk
-- of a transcription error.
-- ---------------------------------------------------------------
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (1, 'reza-fateh', 'رضا', 'فاتح', 'مدیر آموزشگاه موسیقی فاتح', '["violin-course","kamancheh-course"]', 'رضا فاتح مدیر آموزشگاه موسیقی فاتح و مدرس تخصصی ویولن و کمانچه در شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (2, 'khalil-delavaran', 'خلیل', 'دلاوران', 'مدرس گیتار و دروس پایه موسیقی', '["guitar-course","solfege-course","music-theory-course","rhythm-reading-course","voice-training-course"]', 'خلیل دلاوران مدرس گیتار و دروس پایه موسیقی در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (3, 'mohammadali-zafarani', 'محمدعلی', 'زعفرانی', 'مدرس پیانو، ارگ و کیبورد', '["piano-course","keyboard-course"]', 'محمدعلی زعفرانی مدرس پیانو، ارگ و کیبورد در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (4, 'vahid-bahman', 'وحید', 'بهمن', 'مدرس تار و سه تار', '["tar-course","setar-course"]', 'وحید بهمن مدرس تار و سه تار در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (5, 'behnam-iravani', 'بهنام', 'ایروانی', 'مدرس سنتور', '["santur-course"]', 'بهنام ایروانی مدرس سنتور در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (6, 'mojtaba-nejadsafari', 'مجتبی', 'نژاد صفاری', 'مدرس دف و تنبک', '["daf-course","tonbak-course"]', 'مجتبی نژاد صفاری مدرس دف و تنبک در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (7, 'gholamabbas-abbasi', 'غلام عباس', 'عباسی', 'مدرس ضرب تمپو', '["zarb-tempo-course"]', 'غلام عباس عباسی مدرس ساز ضرب تمپو در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (8, 'alireza-eydi-nejad', 'علیرضا', 'عیدی نژاد', 'مدرس نی انبان', '["ney-anban-course"]', 'علیرضا عیدی نژاد مدرس ساز نی انبان در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (9, 'bahram-mousavi', 'بهرام', 'موسوی', 'مدرس نی', '["ney-course"]', 'بهرام موسوی مدرس ساز نی در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (10, 'farnaz-kadkhoda-moradi', 'فرناز', 'کدخدا مرادی', 'مدرس موسیقی کودک', '["children-music-course"]', 'فرناز کدخدا مرادی مدرس تخصصی موسیقی کودک در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (11, 'narges-fateh', 'نرگس', 'فاتح', 'مدرس تنبک', '["tonbak-course"]', 'نرگس فاتح مدرس تنبک در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (12, 'mohsen-naghib', 'محسن', 'نقیب', 'مدرس هنگ درام', '["hangdrum-course"]', 'محسن نقیب مدرس تخصصی هنگ درام در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (13, 'majid-jafarizade', 'مجید', 'جعفری زاده', 'مدرس آواز سنتی و آواز محلی بختیاری', '["traditional-vocal-course","bakhtiari-vocal-course","shushtari-vocal-course"]', 'مجید جعفری زاده مدرس آواز سنتی ایرانی و آواز محلی بختیاری در آموزشگاه موسیقی فاتح شوشتر است.', 1);
INSERT INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES (14, 'reza-bashir', 'رضا', 'بشیرزاده', 'مدرس آواز سنتی، پاپ و محلی شوشتری', '["traditional-vocal-course","pop-vocal-course","shushtari-vocal-course"]', 'رضا بشیرزاده متولی مدرس آواز سنتی، آواز پاپ و آواز محلی شوشتری در آموزشگاه موسیقی فاتح شوشتر است.', 1);
