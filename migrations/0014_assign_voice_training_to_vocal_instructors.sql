-- Move the voice-training course responsibility from Khalil Delavaran
-- to the two vocal instructors: Majid Jafarizade and Reza Bashirzade.
-- The course itself is already linked to instructor IDs 13 and 14;
-- this migration repairs the reciprocal instructor-side relationship in D1.

UPDATE instructors
SET instruments = json_remove(instruments, '$[' || (
  SELECT value
  FROM json_each(instructors.instruments)
  WHERE value = 'voice-training-course'
  LIMIT 1
) || ']'),
    updated_at = datetime('now')
WHERE id = 2
  AND EXISTS (
    SELECT 1
    FROM json_each(instructors.instruments)
    WHERE value = 'voice-training-course'
  );

UPDATE instructors
SET instruments = CASE
  WHEN EXISTS (
    SELECT 1
    FROM json_each(instructors.instruments)
    WHERE value = 'voice-training-course'
  ) THEN instruments
  ELSE json_insert(instruments, '$[#]', 'voice-training-course')
END,
updated_at = datetime('now')
WHERE id IN (13, 14);
