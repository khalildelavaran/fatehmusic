-- Normalize legacy blog content that was inserted with literal backslash escape sequences.
-- This converts the two-character strings \\n and \\r into real line breaks for existing D1 rows.
UPDATE blog_posts
SET content = REPLACE(REPLACE(REPLACE(content, '\\r\\n', char(10)), '\\n', char(10)), '\\r', char(13))
WHERE content LIKE '%\\n%' OR content LIKE '%\\r%';
