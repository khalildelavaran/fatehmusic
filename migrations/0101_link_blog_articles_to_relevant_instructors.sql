-- Migration 0101: link instrument/course articles to the relevant instructor profile.
-- Source of truth: src/data/instructors.js and each post's actual topic/title.
-- Inserts the instructor section before FAQ/conclusion where possible; supports Markdown and HTML.
-- Idempotent: posts that already contain an instructor-profile URL are not modified again.

-- general-music-guide: مدرسان سازها و دوره‌های موسیقی
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>مدرسان سازها و دوره‌های موسیقی</h2><p>برای بررسی مسیرهای آموزشی معرفی‌شده در این راهنما، می‌توانید صفحه مدرسان مربوط به هر حوزه را ببینید: <a href="/instructors/khalil-delavaran">خلیل دلاوران، مدرس گیتار و مبانی موسیقی</a>، <a href="/instructors/mohammadali-zafarani">محمدعلی زعفرانی، مدرس پیانو و کیبورد</a>، <a href="/instructors/reza-fateh">رضا فاتح، مدرس ویولن و کمانچه</a>، <a href="/instructors/vahid-bahman">وحید بهمن، مدرس تار و سه‌تار</a>، <a href="/instructors/behnam-iravani">بهنام ایروانی، مدرس سنتور</a>، <a href="/instructors/mojtaba-nejadsafari">مجتبی نژاد صفاری، مدرس دف و تنبک</a>، <a href="/instructors/narges-fateh">نرگس فاتح، مدرس تنبک</a>، <a href="/instructors/gholamabbas-abbasi">غلام عباس عباسی، مدرس ضرب تمپو</a>، <a href="/instructors/bahram-mousavi">بهرام موسوی، مدرس نی</a>، <a href="/instructors/alireza-eydi-nejad">علیرضا عیدی‌نژاد، مدرس نی‌انبان</a>، <a href="/instructors/mohsen-naghib">محسن نقیب، مدرس هنگ‌درام</a>، <a href="/instructors/farnaz-kadkhoda-moradi">فرناز کدخدا مرادی، مدرس موسیقی کودک</a>، <a href="/instructors/majid-jafarizade">مجید جعفری زاده، مدرس آواز سنتی و محلی</a> و <a href="/instructors/reza-bashir">رضا بشیرزاده، مدرس آواز پاپ و سنتی</a>.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## مدرسان سازها و دوره‌های موسیقی

برای بررسی مسیرهای آموزشی معرفی‌شده در این راهنما، می‌توانید صفحه مدرسان مربوط به هر حوزه را ببینید: [خلیل دلاوران، مدرس گیتار و مبانی موسیقی](/instructors/khalil-delavaran)، [محمدعلی زعفرانی، مدرس پیانو و کیبورد](/instructors/mohammadali-zafarani)، [رضا فاتح، مدرس ویولن و کمانچه](/instructors/reza-fateh)، [وحید بهمن، مدرس تار و سه‌تار](/instructors/vahid-bahman)، [بهنام ایروانی، مدرس سنتور](/instructors/behnam-iravani)، [مجتبی نژاد صفاری، مدرس دف و تنبک](/instructors/mojtaba-nejadsafari)، [نرگس فاتح، مدرس تنبک](/instructors/narges-fateh)، [غلام عباس عباسی، مدرس ضرب تمپو](/instructors/gholamabbas-abbasi)، [بهرام موسوی، مدرس نی](/instructors/bahram-mousavi)، [علیرضا عیدی‌نژاد، مدرس نی‌انبان](/instructors/alireza-eydi-nejad)، [محسن نقیب، مدرس هنگ‌درام](/instructors/mohsen-naghib)، [فرناز کدخدا مرادی، مدرس موسیقی کودک](/instructors/farnaz-kadkhoda-moradi)، [مجید جعفری زاده، مدرس آواز سنتی و محلی](/instructors/majid-jafarizade) و [رضا بشیرزاده، مدرس آواز پاپ و سنتی](/instructors/reza-bashir).

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## مدرسان سازها و دوره‌های موسیقی

برای بررسی مسیرهای آموزشی معرفی‌شده در این راهنما، می‌توانید صفحه مدرسان مربوط به هر حوزه را ببینید: [خلیل دلاوران، مدرس گیتار و مبانی موسیقی](/instructors/khalil-delavaran)، [محمدعلی زعفرانی، مدرس پیانو و کیبورد](/instructors/mohammadali-zafarani)، [رضا فاتح، مدرس ویولن و کمانچه](/instructors/reza-fateh)، [وحید بهمن، مدرس تار و سه‌تار](/instructors/vahid-bahman)، [بهنام ایروانی، مدرس سنتور](/instructors/behnam-iravani)، [مجتبی نژاد صفاری، مدرس دف و تنبک](/instructors/mojtaba-nejadsafari)، [نرگس فاتح، مدرس تنبک](/instructors/narges-fateh)، [غلام عباس عباسی، مدرس ضرب تمپو](/instructors/gholamabbas-abbasi)، [بهرام موسوی، مدرس نی](/instructors/bahram-mousavi)، [علیرضا عیدی‌نژاد، مدرس نی‌انبان](/instructors/alireza-eydi-nejad)، [محسن نقیب، مدرس هنگ‌درام](/instructors/mohsen-naghib)، [فرناز کدخدا مرادی، مدرس موسیقی کودک](/instructors/farnaz-kadkhoda-moradi)، [مجید جعفری زاده، مدرس آواز سنتی و محلی](/instructors/majid-jafarizade) و [رضا بشیرزاده، مدرس آواز پاپ و سنتی](/instructors/reza-bashir).

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## مدرسان سازها و دوره‌های موسیقی

برای بررسی مسیرهای آموزشی معرفی‌شده در این راهنما، می‌توانید صفحه مدرسان مربوط به هر حوزه را ببینید: [خلیل دلاوران، مدرس گیتار و مبانی موسیقی](/instructors/khalil-delavaran)، [محمدعلی زعفرانی، مدرس پیانو و کیبورد](/instructors/mohammadali-zafarani)، [رضا فاتح، مدرس ویولن و کمانچه](/instructors/reza-fateh)، [وحید بهمن، مدرس تار و سه‌تار](/instructors/vahid-bahman)، [بهنام ایروانی، مدرس سنتور](/instructors/behnam-iravani)، [مجتبی نژاد صفاری، مدرس دف و تنبک](/instructors/mojtaba-nejadsafari)، [نرگس فاتح، مدرس تنبک](/instructors/narges-fateh)، [غلام عباس عباسی، مدرس ضرب تمپو](/instructors/gholamabbas-abbasi)، [بهرام موسوی، مدرس نی](/instructors/bahram-mousavi)، [علیرضا عیدی‌نژاد، مدرس نی‌انبان](/instructors/alireza-eydi-nejad)، [محسن نقیب، مدرس هنگ‌درام](/instructors/mohsen-naghib)، [فرناز کدخدا مرادی، مدرس موسیقی کودک](/instructors/farnaz-kadkhoda-moradi)، [مجید جعفری زاده، مدرس آواز سنتی و محلی](/instructors/majid-jafarizade) و [رضا بشیرزاده، مدرس آواز پاپ و سنتی](/instructors/reza-bashir).'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (slug = 'music-education-local')
  AND instr(content, '/instructors/') = 0;

-- vocal-multi-teacher: مدرسان آواز
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>مدرسان آواز</h2><p>برای آشنایی با مدرس‌های این حوزه، صفحه <a href="/instructors/majid-jafarizade">مجید جعفری زاده، مدرس آواز سنتی و محلی</a> و <a href="/instructors/reza-bashir">رضا بشیرزاده، مدرس آواز پاپ و سنتی</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## مدرسان آواز

برای آشنایی با مدرس‌های این حوزه، صفحه [مجید جعفری زاده، مدرس آواز سنتی و محلی](/instructors/majid-jafarizade) و [رضا بشیرزاده، مدرس آواز پاپ و سنتی](/instructors/reza-bashir) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## مدرسان آواز

برای آشنایی با مدرس‌های این حوزه، صفحه [مجید جعفری زاده، مدرس آواز سنتی و محلی](/instructors/majid-jafarizade) و [رضا بشیرزاده، مدرس آواز پاپ و سنتی](/instructors/reza-bashir) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## مدرسان آواز

برای آشنایی با مدرس‌های این حوزه، صفحه [مجید جعفری زاده، مدرس آواز سنتی و محلی](/instructors/majid-jafarizade) و [رضا بشیرزاده، مدرس آواز پاپ و سنتی](/instructors/reza-bashir) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug IN ('traditional-vocal-course','shushtari-vocal-course','vocal-shushtar') OR slug IN ('pop-vs-traditional-vocal','rhythm-reading-course-shushtar'))
  AND instr(content, '/instructors/') = 0;

-- children-music: مدرس موسیقی کودک
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>مدرس موسیقی کودک</h2><p>برای آشنایی با روش آموزشی و مدرس این حوزه، صفحه <a href="/instructors/farnaz-kadkhoda-moradi">فرناز کدخدا مرادی، مدرس موسیقی کودک</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## مدرس موسیقی کودک

برای آشنایی با روش آموزشی و مدرس این حوزه، صفحه [فرناز کدخدا مرادی، مدرس موسیقی کودک](/instructors/farnaz-kadkhoda-moradi) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## مدرس موسیقی کودک

برای آشنایی با روش آموزشی و مدرس این حوزه، صفحه [فرناز کدخدا مرادی، مدرس موسیقی کودک](/instructors/farnaz-kadkhoda-moradi) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## مدرس موسیقی کودک

برای آشنایی با روش آموزشی و مدرس این حوزه، صفحه [فرناز کدخدا مرادی، مدرس موسیقی کودک](/instructors/farnaz-kadkhoda-moradi) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'children-music-course' OR slug = 'private-vs-group-music-class')
  AND instr(content, '/instructors/') = 0;

-- guitar: استاد گیتار
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد گیتار</h2><p>برای آشنایی با مدرس این مسیر و دوره‌های گیتار، صفحه <a href="/instructors/khalil-delavaran">خلیل دلاوران، استاد گیتار</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد گیتار

برای آشنایی با مدرس این مسیر و دوره‌های گیتار، صفحه [خلیل دلاوران، استاد گیتار](/instructors/khalil-delavaran) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد گیتار

برای آشنایی با مدرس این مسیر و دوره‌های گیتار، صفحه [خلیل دلاوران، استاد گیتار](/instructors/khalil-delavaran) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد گیتار

برای آشنایی با مدرس این مسیر و دوره‌های گیتار، صفحه [خلیل دلاوران، استاد گیتار](/instructors/khalil-delavaran) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'guitar-course')
  AND instr(content, '/instructors/') = 0;

-- violin-kamancheh: استاد ویولن و کمانچه
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد ویولن و کمانچه</h2><p>برای آشنایی با مدرس این دو ساز، صفحه <a href="/instructors/reza-fateh">رضا فاتح، استاد ویولن و کمانچه</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد ویولن و کمانچه

برای آشنایی با مدرس این دو ساز، صفحه [رضا فاتح، استاد ویولن و کمانچه](/instructors/reza-fateh) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد ویولن و کمانچه

برای آشنایی با مدرس این دو ساز، صفحه [رضا فاتح، استاد ویولن و کمانچه](/instructors/reza-fateh) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد ویولن و کمانچه

برای آشنایی با مدرس این دو ساز، صفحه [رضا فاتح، استاد ویولن و کمانچه](/instructors/reza-fateh) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug IN ('violin-course','kamancheh-course'))
  AND instr(content, '/instructors/') = 0;

-- piano-keyboard: استاد پیانو و کیبورد
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد پیانو و کیبورد</h2><p>برای آشنایی با مدرس این دوره‌ها، صفحه <a href="/instructors/mohammadali-zafarani">محمدعلی زعفرانی، استاد پیانو و کیبورد</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد پیانو و کیبورد

برای آشنایی با مدرس این دوره‌ها، صفحه [محمدعلی زعفرانی، استاد پیانو و کیبورد](/instructors/mohammadali-zafarani) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد پیانو و کیبورد

برای آشنایی با مدرس این دوره‌ها، صفحه [محمدعلی زعفرانی، استاد پیانو و کیبورد](/instructors/mohammadali-zafarani) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد پیانو و کیبورد

برای آشنایی با مدرس این دوره‌ها، صفحه [محمدعلی زعفرانی، استاد پیانو و کیبورد](/instructors/mohammadali-zafarani) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug IN ('piano-course','keyboard-course'))
  AND instr(content, '/instructors/') = 0;

-- tar-setar: استاد تار و سه‌تار
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد تار و سه‌تار</h2><p>برای آشنایی با مدرس این سازهای ایرانی، صفحه <a href="/instructors/vahid-bahman">وحید بهمن، استاد تار و سه‌تار</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد تار و سه‌تار

برای آشنایی با مدرس این سازهای ایرانی، صفحه [وحید بهمن، استاد تار و سه‌تار](/instructors/vahid-bahman) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد تار و سه‌تار

برای آشنایی با مدرس این سازهای ایرانی، صفحه [وحید بهمن، استاد تار و سه‌تار](/instructors/vahid-bahman) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد تار و سه‌تار

برای آشنایی با مدرس این سازهای ایرانی، صفحه [وحید بهمن، استاد تار و سه‌تار](/instructors/vahid-bahman) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug IN ('tar-course','tar','setar-course') OR slug = 'rhythm-reading-course')
  AND instr(content, '/instructors/') = 0;

-- santur: استاد سنتور
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد سنتور</h2><p>برای آشنایی با مدرس سنتور، صفحه <a href="/instructors/behnam-iravani">بهنام ایروانی، استاد سنتور</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد سنتور

برای آشنایی با مدرس سنتور، صفحه [بهنام ایروانی، استاد سنتور](/instructors/behnam-iravani) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد سنتور

برای آشنایی با مدرس سنتور، صفحه [بهنام ایروانی، استاد سنتور](/instructors/behnam-iravani) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد سنتور

برای آشنایی با مدرس سنتور، صفحه [بهنام ایروانی، استاد سنتور](/instructors/behnam-iravani) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'santur-course')
  AND instr(content, '/instructors/') = 0;

-- daf: استاد دف
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد دف</h2><p>برای آشنایی با مدرس دف، صفحه <a href="/instructors/mojtaba-nejadsafari">مجتبی نژاد صفاری، استاد دف</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد دف

برای آشنایی با مدرس دف، صفحه [مجتبی نژاد صفاری، استاد دف](/instructors/mojtaba-nejadsafari) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد دف

برای آشنایی با مدرس دف، صفحه [مجتبی نژاد صفاری، استاد دف](/instructors/mojtaba-nejadsafari) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد دف

برای آشنایی با مدرس دف، صفحه [مجتبی نژاد صفاری، استاد دف](/instructors/mojtaba-nejadsafari) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'daf-course')
  AND instr(content, '/instructors/') = 0;

-- tonbak: مدرسان تنبک
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>مدرسان تنبک</h2><p>در دوره تنبک، می‌توانید با مدرسان مرتبط آشنا شوید: <a href="/instructors/mojtaba-nejadsafari">مجتبی نژاد صفاری، مدرس تنبک</a> و <a href="/instructors/narges-fateh">نرگس فاتح، مدرس تنبک</a>.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## مدرسان تنبک

در دوره تنبک، می‌توانید با مدرسان مرتبط آشنا شوید: [مجتبی نژاد صفاری، مدرس تنبک](/instructors/mojtaba-nejadsafari) و [نرگس فاتح، مدرس تنبک](/instructors/narges-fateh).

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## مدرسان تنبک

در دوره تنبک، می‌توانید با مدرسان مرتبط آشنا شوید: [مجتبی نژاد صفاری، مدرس تنبک](/instructors/mojtaba-nejadsafari) و [نرگس فاتح، مدرس تنبک](/instructors/narges-fateh).

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## مدرسان تنبک

در دوره تنبک، می‌توانید با مدرسان مرتبط آشنا شوید: [مجتبی نژاد صفاری، مدرس تنبک](/instructors/mojtaba-nejadsafari) و [نرگس فاتح، مدرس تنبک](/instructors/narges-fateh).'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'tonbak-course')
  AND instr(content, '/instructors/') = 0;

-- zarb-tempo: استاد ضرب تمپو
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد ضرب تمپو</h2><p>برای آشنایی با مدرس این ساز، صفحه <a href="/instructors/gholamabbas-abbasi">غلام عباس عباسی، استاد ضرب تمپو</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد ضرب تمپو

برای آشنایی با مدرس این ساز، صفحه [غلام عباس عباسی، استاد ضرب تمپو](/instructors/gholamabbas-abbasi) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد ضرب تمپو

برای آشنایی با مدرس این ساز، صفحه [غلام عباس عباسی، استاد ضرب تمپو](/instructors/gholamabbas-abbasi) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد ضرب تمپو

برای آشنایی با مدرس این ساز، صفحه [غلام عباس عباسی، استاد ضرب تمپو](/instructors/gholamabbas-abbasi) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'zarb-tempo-course' OR slug IN ('ney','tempo-darb-common-mistakes','tempo-darb-from-zero'))
  AND instr(content, '/instructors/') = 0;

-- ney-anban: استاد نی‌انبان
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد نی‌انبان</h2><p>برای آشنایی با مدرس نی‌انبان، صفحه <a href="/instructors/alireza-eydi-nejad">علیرضا عیدی‌نژاد، استاد نی‌انبان</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد نی‌انبان

برای آشنایی با مدرس نی‌انبان، صفحه [علیرضا عیدی‌نژاد، استاد نی‌انبان](/instructors/alireza-eydi-nejad) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد نی‌انبان

برای آشنایی با مدرس نی‌انبان، صفحه [علیرضا عیدی‌نژاد، استاد نی‌انبان](/instructors/alireza-eydi-nejad) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد نی‌انبان

برای آشنایی با مدرس نی‌انبان، صفحه [علیرضا عیدی‌نژاد، استاد نی‌انبان](/instructors/alireza-eydi-nejad) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'ney-anban-course')
  AND instr(content, '/instructors/') = 0;

-- ney: استاد نی
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد نی</h2><p>برای آشنایی با مدرس نی، صفحه <a href="/instructors/bahram-mousavi">بهرام موسوی، استاد نی</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد نی

برای آشنایی با مدرس نی، صفحه [بهرام موسوی، استاد نی](/instructors/bahram-mousavi) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد نی

برای آشنایی با مدرس نی، صفحه [بهرام موسوی، استاد نی](/instructors/bahram-mousavi) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد نی

برای آشنایی با مدرس نی، صفحه [بهرام موسوی، استاد نی](/instructors/bahram-mousavi) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'ney-course')
  AND instr(content, '/instructors/') = 0;

-- hangdrum: استاد هنگ‌درام
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>استاد هنگ‌درام</h2><p>برای آشنایی با مدرس هنگ‌درام، صفحه <a href="/instructors/mohsen-naghib">محسن نقیب، استاد هنگ‌درام</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## استاد هنگ‌درام

برای آشنایی با مدرس هنگ‌درام، صفحه [محسن نقیب، استاد هنگ‌درام](/instructors/mohsen-naghib) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## استاد هنگ‌درام

برای آشنایی با مدرس هنگ‌درام، صفحه [محسن نقیب، استاد هنگ‌درام](/instructors/mohsen-naghib) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## استاد هنگ‌درام

برای آشنایی با مدرس هنگ‌درام، صفحه [محسن نقیب، استاد هنگ‌درام](/instructors/mohsen-naghib) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'hangdrum-course')
  AND instr(content, '/instructors/') = 0;

-- bakhtiari-vocal: مدرس آواز محلی بختیاری
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>مدرس آواز محلی بختیاری</h2><p>برای آشنایی با مدرس آواز محلی، صفحه <a href="/instructors/majid-jafarizade">مجید جعفری زاده، مدرس آواز محلی بختیاری</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## مدرس آواز محلی بختیاری

برای آشنایی با مدرس آواز محلی، صفحه [مجید جعفری زاده، مدرس آواز محلی بختیاری](/instructors/majid-jafarizade) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## مدرس آواز محلی بختیاری

برای آشنایی با مدرس آواز محلی، صفحه [مجید جعفری زاده، مدرس آواز محلی بختیاری](/instructors/majid-jafarizade) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## مدرس آواز محلی بختیاری

برای آشنایی با مدرس آواز محلی، صفحه [مجید جعفری زاده، مدرس آواز محلی بختیاری](/instructors/majid-jafarizade) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'bakhtiari-vocal-course' OR slug = 'bakhtiari-vocal-from-zero')
  AND instr(content, '/instructors/') = 0;

-- pop-vocal: مدرس آواز پاپ
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>مدرس آواز پاپ</h2><p>برای آشنایی با مدرس آواز پاپ، صفحه <a href="/instructors/reza-bashir">رضا بشیرزاده، مدرس آواز پاپ</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## مدرس آواز پاپ

برای آشنایی با مدرس آواز پاپ، صفحه [رضا بشیرزاده، مدرس آواز پاپ](/instructors/reza-bashir) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## مدرس آواز پاپ

برای آشنایی با مدرس آواز پاپ، صفحه [رضا بشیرزاده، مدرس آواز پاپ](/instructors/reza-bashir) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## مدرس آواز پاپ

برای آشنایی با مدرس آواز پاپ، صفحه [رضا بشیرزاده، مدرس آواز پاپ](/instructors/reza-bashir) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug = 'pop-vocal-course')
  AND instr(content, '/instructors/') = 0;

-- khalil-core-teaching: مدرس مبانی موسیقی
UPDATE blog_posts
SET content = CASE
    WHEN instr(content, '<p') > 0 OR instr(content, '<h2') > 0
      THEN content || char(10) || char(10) || '<h2>مدرس مبانی موسیقی</h2><p>برای آشنایی با مدرس این مباحث، صفحه <a href="/instructors/khalil-delavaran">خلیل دلاوران، مدرس سلفژ، تئوری موسیقی، ریتم و صداسازی</a> را ببینید.</p>'
    WHEN instr(content, '## پرسش‌های متداول') > 0
      THEN replace(content, '## پرسش‌های متداول', '## مدرس مبانی موسیقی

برای آشنایی با مدرس این مباحث، صفحه [خلیل دلاوران، مدرس سلفژ، تئوری موسیقی، ریتم و صداسازی](/instructors/khalil-delavaran) را ببینید.

## پرسش‌های متداول')
    WHEN instr(content, '## جمع‌بندی') > 0
      THEN replace(content, '## جمع‌بندی', '## مدرس مبانی موسیقی

برای آشنایی با مدرس این مباحث، صفحه [خلیل دلاوران، مدرس سلفژ، تئوری موسیقی، ریتم و صداسازی](/instructors/khalil-delavaran) را ببینید.

## جمع‌بندی')
    ELSE content || char(10) || char(10) || '## مدرس مبانی موسیقی

برای آشنایی با مدرس این مباحث، صفحه [خلیل دلاوران، مدرس سلفژ، تئوری موسیقی، ریتم و صداسازی](/instructors/khalil-delavaran) را ببینید.'
  END,
    updated_at = datetime('now')
WHERE status IN ('published','draft')
  AND (related_course_slug IN ('voice-training-course','solfege-course') OR (related_course_slug = 'music-theory-course' AND slug <> 'music-education-local') OR slug = 'rhythm-reading-from-zero')
  AND instr(content, '/instructors/') = 0;
