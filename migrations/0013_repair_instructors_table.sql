-- Migration 0013: defensive repair for production D1 instructor storage.
--
-- Some environments may have the migration ledger ahead of the actual
-- instructor table. Keep this migration idempotent so it is safe when 0012
-- was already applied correctly.

CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  specialty TEXT NOT NULL DEFAULT '',
  instruments TEXT NOT NULL DEFAULT '[]',
  biography TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_instructors_active ON instructors(is_active);

-- Seed only missing operational rows. Existing administrator edits are never overwritten.
INSERT OR IGNORE INTO instructors (id, slug, first_name, last_name, specialty, instruments, biography, is_active) VALUES
(1, 'reza-fateh', 'رضا', 'فاتح', 'مدیر آموزشگاه موسیقی فاتح', '["violin-course","kamancheh-course"]', 'رضا فاتح مدیر آموزشگاه موسیقی فاتح و مدرس تخصصی ویولن و کمانچه در شوشتر است.', 1),
(2, 'khalil-delavaran', 'خلیل', 'دلاوران', 'مدرس گیتار و دروس پایه موسیقی', '["guitar-course","solfege-course","music-theory-course","rhythm-reading-course","voice-training-course"]', 'خلیل دلاوران مدرس گیتار و دروس پایه موسیقی در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(3, 'mohammadali-zafarani', 'محمدعلی', 'زعفرانی', 'مدرس پیانو، ارگ و کیبورد', '["piano-course","keyboard-course"]', 'محمدعلی زعفرانی مدرس پیانو، ارگ و کیبورد در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(4, 'vahid-bahman', 'وحید', 'بهمن', 'مدرس تار و سه تار', '["tar-course","setar-course"]', 'وحید بهمن مدرس تار و سه تار در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(5, 'behnam-iravani', 'بهنام', 'ایروانی', 'مدرس سنتور', '["santur-course"]', 'بهنام ایروانی مدرس سنتور در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(6, 'mojtaba-nejadsafari', 'مجتبی', 'نژاد صفاری', 'مدرس دف و تنبک', '["daf-course","tonbak-course"]', 'مجتبی نژاد صفاری مدرس دف و تنبک در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(7, 'gholamabbas-abbasi', 'غلام عباس', 'عباسی', 'مدرس ضرب تمپو', '["zarb-tempo-course"]', 'غلام عباس عباسی مدرس ساز ضرب تمپو در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(8, 'alireza-eydi-nejad', 'علیرضا', 'عیدی نژاد', 'مدرس نی انبان', '["ney-anban-course"]', 'علیرضا عیدی نژاد مدرس ساز نی انبان در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(9, 'bahram-mousavi', 'بهرام', 'موسوی', 'مدرس نی', '["ney-course"]', 'بهرام موسوی مدرس ساز نی در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(10, 'farnaz-kadkhoda-moradi', 'فرناز', 'کدخدا مرادی', 'مدرس موسیقی کودک', '["children-music-course"]', 'فرناز کدخدا مرادی مدرس تخصصی موسیقی کودک در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(11, 'narges-fateh', 'نرگس', 'فاتح', 'مدرس تنبک', '["tonbak-course"]', 'نرگس فاتح مدرس تنبک در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(12, 'mohsen-naghib', 'محسن', 'نقیب', 'مدرس هنگ درام', '["hangdrum-course"]', 'محسن نقیب مدرس تخصصی هنگ درام در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(13, 'majid-jafarizade', 'مجید', 'جعفری زاده', 'مدرس آواز سنتی و آواز محلی بختیاری', '["traditional-vocal-course","bakhtiari-vocal-course","shushtari-vocal-course"]', 'مجید جعفری زاده مدرس آواز سنتی ایرانی و آواز محلی بختیاری در آموزشگاه موسیقی فاتح شوشتر است.', 1),
(14, 'reza-bashir', 'رضا', 'بشیرزاده', 'مدرس آواز سنتی، پاپ و محلی شوشتری', '["traditional-vocal-course","pop-vocal-course","shushtari-vocal-course"]', 'رضا بشیرزاده متولی مدرس آواز سنتی، آواز پاپ و آواز محلی شوشتری در آموزشگاه موسیقی فاتح شوشتر است.', 1);
