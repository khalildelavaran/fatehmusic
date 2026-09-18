-- ====================================================================
-- Migration 0044: replace the leftover test rooms with real ones.
--
-- Migration 0033 seeded rooms named 'تست اتاق 01'..'08' with
-- notes = 'TEST DATA — operational planner room'. Migration 0043
-- deactivated/deleted test classes/students/enrollments but did not
-- check `rooms.notes`, so these 8 fake rooms were left behind. No real
-- room has ever been created in this installation -- src/data/
-- schedule.js (the site's real, hand-maintained weekly schedule)
-- references classroom numbers 1 through 5, so those become the real
-- rooms here.
--
-- Idempotent: safe to run more than once.
-- ====================================================================

DELETE FROM rooms WHERE notes LIKE '%TEST DATA%';

INSERT INTO rooms (name, capacity, status, notes)
SELECT 'اتاق ۱', 1, 'active', ''
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'اتاق ۱');

INSERT INTO rooms (name, capacity, status, notes)
SELECT 'اتاق ۲', 1, 'active', ''
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'اتاق ۲');

INSERT INTO rooms (name, capacity, status, notes)
SELECT 'اتاق ۳', 1, 'active', ''
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'اتاق ۳');

INSERT INTO rooms (name, capacity, status, notes)
SELECT 'اتاق ۴', 1, 'active', ''
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'اتاق ۴');

INSERT INTO rooms (name, capacity, status, notes)
SELECT 'اتاق ۵', 10, 'active', 'اتاق کلاس گروهی موسیقی کودک'
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'اتاق ۵');
