-- SEO Content Engine lifecycle: distinguish an AI-generated draft from a published topic.
--
-- Older versions marked a topic as "used" when the draft was created. That
-- permanently consumed the opportunity even when the draft was rejected/deleted.
-- Published posts remain "used"; draft-linked topics become "drafted" so they
-- can be released back to the approved queue when the draft is unpublished.

UPDATE content_topics
SET status = 'drafted',
    updated_at = datetime('now')
WHERE status = 'used'
  AND used_by_post_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM blog_posts p
    WHERE p.id = content_topics.used_by_post_id
      AND p.status = 'draft'
  );
