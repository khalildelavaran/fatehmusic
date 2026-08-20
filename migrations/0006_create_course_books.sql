-- ====================================================================
-- Migration 0006: course_books
--
-- Books/methods a student can be certified as having completed.
-- Deliberately its own table (not a static file) so staff can add new
-- books to any course later through /admin/books, with no code deploy
-- needed -- see doc/ADR/ADR-012 — Certificate Issuance System.md.
--
-- One course can have many books (sequential levels, or alternative
-- methods by different authors). tar-course and setar-course share the
-- same three-volume method, so that method is inserted twice (once per
-- course_slug) rather than modeling a many-to-many join, to keep every
-- other query ("books for this course") a single flat SELECT.
--
-- Courses with no rows yet (kamancheh, keyboard, zarb-tempo, ney-anban,
-- the 4 vocal courses, solfege, voice-training) simply show an empty
-- list in the admin UI and an empty dropdown at certificate time --
-- that is expected, not a bug, until real book data is added for them.
-- ====================================================================

CREATE TABLE IF NOT EXISTS course_books (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  course_slug    TEXT NOT NULL,             -- matches courses[].slug in src/data/courses.js
  title          TEXT NOT NULL,
  author         TEXT,                      -- NULL when not confirmed (never guessed/invented)
  level          TEXT,                      -- مقدماتی | متوسط | پیشرفته | عالی | NULL
  cover_image    TEXT,                      -- filename under public/images/books/
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_course_books_slug ON course_books(course_slug);

-- ---------------------------------------------------------------
-- Seed data transcribed directly from the book.txt/Book.zip the
-- site owner provided (2026-08-20). Nothing here is invented --
-- authors left NULL where the source list did not give one
-- (the four "Enjoy Guitar" volumes only had a filename, not a
-- confirmed Persian author name).
-- ---------------------------------------------------------------

-- پیانو
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('piano-course', 'چهل آهنگ برگزیده برای پیانو', 'ناصر جهان‌آرای', '40piano.jpg', 1),
  ('piano-course', '۸۵ نوای ماندگار پیانو', 'محمد امیدوار تهرانی', '85piano.jpg', 2),
  ('piano-course', 'جان تامسون - کتاب اول', NULL, 'tamson1.jpg', 3),
  ('piano-course', 'جان تامسون - کتاب دوم', NULL, 'tamson2.jpg', 4),
  ('piano-course', 'جان تامسون - کتاب سوم', NULL, 'tamson3.jpg', 5);

-- نی
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('ney-course', 'شیوه نی‌نوازی', 'محمدعلی کیانی‌نژاد', 'ney-kiani.jpg', 1);

-- دف
INSERT INTO course_books (course_slug, title, author, level, cover_image, display_order) VALUES
  ('daf-course', 'دوره مقدماتی دف‌نوازی - کتاب اول', 'حمید کرباسی‌زاده', 'مقدماتی', 'daf1-karbasi.jpg', 1),
  ('daf-course', 'دوره متوسطه دف‌نوازی - کتاب دوم', 'حمید کرباسی‌زاده', 'متوسط', 'daf2-karbasi.jpg', 2),
  ('daf-course', 'دوره پیشرفته دف‌نوازی - کتاب سوم', 'حمید کرباسی‌زاده', 'پیشرفته', 'daf3-karbasi.jpg', 3),
  ('daf-course', 'دوره عالی دف‌نوازی - کتاب چهارم', 'حمید کرباسی‌زاده', 'عالی', 'daf4-karbasi.jpg', 4);
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('daf-course', 'آموزش دف از مبتدی تا عالی - کتاب اول و دوم', 'سیامک عزیززاده', 'daf-azizzadeh.jpg', 5);

-- هنگ درام
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('hangdrum-course', 'آموزش ساز هندپن - کتاب اول (ر مینور)', 'میثم منتظران', 'handpan1.jpg', 1);

-- ویولن
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('violin-course', 'دستور مقدماتی ویولن - کتاب اول هنرستان', 'روح‌الله خالقی', 'violion1-khaleghi.jpg', 1),
  ('violin-course', 'دستور مقدماتی ویولن - کتاب دوم هنرستان', 'روح‌الله خالقی', 'violion2-khaleghi.jpg', 2),
  ('violin-course', 'له ویولن ۱', 'ماتیو کریک‌بوم', 'leviolion1.jpg', 3);

-- موسیقی کودک
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('children-music-course', 'نردبان آسمان - کتاب اول', 'کامیار حبیبی، کیانوش حبیبی', 'nardeban1.jpg', 1),
  ('children-music-course', 'نردبان آسمان - کتاب دوم', 'کامیار حبیبی، کیانوش حبیبی', 'nardeban2.jpg', 2);

-- ریتم و وزن‌خوانی
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('rhythm-reading-course', 'ریتم در موسیقی', 'شهرام مظلومی', 'rythm.png', 1),
  ('rhythm-reading-course', 'وزن‌خوانی ۱', 'علی‌اکبر شکارچی', 'vaznkhani-shekarchi.jpg', 2);

-- سنتور
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('santur-course', 'دستور سنتور', 'فرامرز پایور', 'santor-payvar.jpg', 1);

-- تار و سه‌تار (کتاب مشترک، برای هر دو دوره جداگانه ثبت شده)
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('tar-course', 'بیایید تار و سه‌تار بنوازیم - کتاب اول', 'کیوان ساکت', 'tar&setar1-saket.jpg', 1),
  ('tar-course', 'بیایید تار و سه‌تار بنوازیم - کتاب دوم', 'کیوان ساکت', 'tar&setar2-saket.jpg', 2),
  ('tar-course', 'بیایید تار و سه‌تار بنوازیم - کتاب سوم', 'کیوان ساکت', 'tar&setar3-saket.jpg', 3),
  ('setar-course', 'بیایید تار و سه‌تار بنوازیم - کتاب اول', 'کیوان ساکت', 'tar&setar1-saket.jpg', 1),
  ('setar-course', 'بیایید تار و سه‌تار بنوازیم - کتاب دوم', 'کیوان ساکت', 'tar&setar2-saket.jpg', 2),
  ('setar-course', 'بیایید تار و سه‌تار بنوازیم - کتاب سوم', 'کیوان ساکت', 'tar&setar3-saket.jpg', 3);

-- تئوری موسیقی
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('music-theory-course', 'تئوری موسیقی', 'مصطفی کمال پورتراب', 'teory-portorab.jpg', 1);

-- تنبک
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('tonbak-course', 'مقدمات تنبک‌نوازی - کتاب اول', 'مجید حسابی', 'tonbak1-hesabi.jpg', 1),
  ('tonbak-course', 'مبانی تنبک‌نوازی ۱', 'محمدجعفر قاضی‌عسکر', 'tonbak1-ghazi.png', 2),
  ('tonbak-course', 'مبانی تنبک‌نوازی ۲', 'محمدجعفر قاضی‌عسکر', 'tonbak2-ghazi.jpg', 3),
  ('tonbak-course', 'مبانی تنبک‌نوازی ۳', 'محمدجعفر قاضی‌عسکر', 'tonbak3-ghazi.jpg', 4);

-- گیتار
INSERT INTO course_books (course_slug, title, author, cover_image, display_order) VALUES
  ('guitar-course', 'اصول همراهی آواز با گیتار', 'فرزاد امیرانی', 'pop1-amirani.jpg', 1),
  ('guitar-course', 'درس‌هایی برای همراهی آواز با گیتار', 'فرزاد امیرانی', 'pop2-amirani.jpg', 2),
  ('guitar-course', 'از نواختن گیتار لذت ببرید ۱', NULL, 'enjoy1-ahourakarbasi-guitar.jpg', 3),
  ('guitar-course', 'از نواختن گیتار لذت ببرید ۲', NULL, 'enjoy2-ahourakarbasi-guitar.jpg', 4),
  ('guitar-course', 'از نواختن گیتار لذت ببرید ۳', NULL, 'enjoy3-ahourakarbasi-guitar.jpg', 5),
  ('guitar-course', 'از نواختن گیتار لذت ببرید ۴', NULL, 'enjoy4-ahourakarbasi.jpg', 6);
