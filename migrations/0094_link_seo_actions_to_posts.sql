-- Make the SEO closed loop resilient to slug/title changes.
ALTER TABLE seo_action_log ADD COLUMN target_post_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_seo_actions_post
  ON seo_action_log(target_post_id);
