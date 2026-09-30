-- Remove stale local topic rows whose course already has a Shushtar blog article.
-- This is intentionally title + course based so legacy rows with an incorrect
-- modifier_type are cleaned up as well.
DELETE FROM content_topics
WHERE status IN ('candidate','approved')
  AND related_course_slug IS NOT NULL
  AND title LIKE '%شوشتر%'
  AND EXISTS (
    SELECT 1
    FROM blog_posts p
    WHERE p.related_course_slug = content_topics.related_course_slug
      AND p.title LIKE '%شوشتر%'
  );