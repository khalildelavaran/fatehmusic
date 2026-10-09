-- Migration 0100: Create AI Engine Settings Table
-- Supports multi-provider content generation (Google Gemini as default, Anthropic Claude, OpenAI)
-- Persistent configuration for scheduling, models, retries, and run tracking.

CREATE TABLE IF NOT EXISTS ai_engine_settings (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  provider                  TEXT NOT NULL DEFAULT 'gemini', -- 'gemini' | 'claude' | 'openai'
  model                     TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  auto_generation_enabled   INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
  daily_count               INTEGER NOT NULL DEFAULT 1,
  schedule_time             TEXT NOT NULL DEFAULT '02:30',
  timezone                  TEXT NOT NULL DEFAULT 'Asia/Tehran',
  save_mode                 TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'published'
  max_retries               INTEGER NOT NULL DEFAULT 2,
  last_test_at              TEXT,
  last_test_status          TEXT, -- 'success' | 'failed' | NULL
  last_test_message         TEXT,
  last_run_at               TEXT,
  last_run_status           TEXT, -- 'success' | 'failed' | NULL
  last_run_message          TEXT,
  last_article_slug         TEXT,
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ai_engine_settings (id, provider, model, auto_generation_enabled, daily_count, schedule_time, timezone, save_mode)
VALUES (1, 'gemini', 'gemini-3.8-flash', 0, 1, '02:30', 'Asia/Tehran', 'draft');
