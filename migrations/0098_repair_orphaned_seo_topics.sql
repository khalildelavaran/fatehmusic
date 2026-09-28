-- Repair stale SEO topic reservations left by older lifecycle behavior.
-- A topic is truly "used" only when it is linked to an existing published post.
-- Draft-linked rows were handled by 0097; this migration releases used rows
-- whose linked post is missing or no longer published.

UPDATE content_topics
SET status = 'approved',
    used_by_post_id = NULL,
    used_at = NULL,
    updated_at = datetime('now')
WHERE status = 'used'
  AND (
    used_by_post_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM blog_posts p
      WHERE p.id = content_topics.used_by_post_id
        AND p.status = 'published'
    )
  );
