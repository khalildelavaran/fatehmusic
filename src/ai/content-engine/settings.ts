// Persistent configuration management for the AI Content Engine.
// Stores and retrieves settings from D1 database with defensive fallbacks.

import type { AiEngineSettings, AiProvider } from "./types";
import { DEFAULT_PROVIDER, DEFAULT_MODELS, isValidProvider, isValidModelForProvider, getDefaultModelForProvider } from "./providers/models";

const DEFAULT_SETTINGS: AiEngineSettings = {
  id: 1,
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODELS[DEFAULT_PROVIDER],
  auto_generation_enabled: false,
  daily_count: 1,
  schedule_time: "02:30",
  timezone: "Asia/Tehran",
  save_mode: "draft",
  max_retries: 2,
  last_test_at: null,
  last_test_status: null,
  last_test_message: null,
  last_run_at: null,
  last_run_status: null,
  last_run_message: null,
  last_article_slug: null,
  updated_at: new Date().toISOString()
};

const ENSURE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ai_engine_settings (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  provider                  TEXT NOT NULL DEFAULT 'gemini',
  model                     TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  auto_generation_enabled   INTEGER NOT NULL DEFAULT 0,
  daily_count               INTEGER NOT NULL DEFAULT 1,
  schedule_time             TEXT NOT NULL DEFAULT '02:30',
  timezone                  TEXT NOT NULL DEFAULT 'Asia/Tehran',
  save_mode                 TEXT NOT NULL DEFAULT 'draft',
  max_retries               INTEGER NOT NULL DEFAULT 2,
  last_test_at              TEXT,
  last_test_status          TEXT,
  last_test_message         TEXT,
  last_run_at               TEXT,
  last_run_status           TEXT,
  last_run_message          TEXT,
  last_article_slug         TEXT,
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export async function getAiEngineSettings(db: D1Database | null | undefined): Promise<AiEngineSettings> {
  if (!db) return { ...DEFAULT_SETTINGS };

  try {
    const row = await db.prepare("SELECT * FROM ai_engine_settings WHERE id = 1 LIMIT 1").first<any>();
    if (row) {
      return {
        id: Number(row.id || 1),
        provider: isValidProvider(row.provider) ? row.provider : DEFAULT_PROVIDER,
        model: String(row.model || DEFAULT_MODELS[DEFAULT_PROVIDER]),
        auto_generation_enabled: Boolean(row.auto_generation_enabled === 1 || row.auto_generation_enabled === true),
        daily_count: Math.max(1, Math.min(5, Number(row.daily_count || 1))),
        schedule_time: String(row.schedule_time || "02:30"),
        timezone: String(row.timezone || "Asia/Tehran"),
        save_mode: row.save_mode === "published" ? "published" : "draft",
        max_retries: Number(row.max_retries || 2),
        last_test_at: row.last_test_at ? String(row.last_test_at) : null,
        last_test_status: row.last_test_status === "success" || row.last_test_status === "failed" ? row.last_test_status : null,
        last_test_message: row.last_test_message ? String(row.last_test_message) : null,
        last_run_at: row.last_run_at ? String(row.last_run_at) : null,
        last_run_status: row.last_run_status === "success" || row.last_run_status === "failed" ? row.last_run_status : null,
        last_run_message: row.last_run_message ? String(row.last_run_message) : null,
        last_article_slug: row.last_article_slug ? String(row.last_article_slug) : null,
        updated_at: String(row.updated_at || new Date().toISOString())
      };
    }

    // Initialize row if absent
    await db.exec(ENSURE_TABLE_SQL);
    await db.prepare(`
      INSERT OR IGNORE INTO ai_engine_settings (id, provider, model, auto_generation_enabled, daily_count, schedule_time, timezone, save_mode)
      VALUES (1, 'gemini', 'gemini-3.8-flash', 0, 1, '02:30', 'Asia/Tehran', 'draft')
    `).run();

    return { ...DEFAULT_SETTINGS };
  } catch (err) {
    // If table doesn't exist yet, attempt to create
    try {
      await db.exec(ENSURE_TABLE_SQL);
      await db.prepare(`
        INSERT OR IGNORE INTO ai_engine_settings (id, provider, model, auto_generation_enabled, daily_count, schedule_time, timezone, save_mode)
        VALUES (1, 'gemini', 'gemini-3.8-flash', 0, 1, '02:30', 'Asia/Tehran', 'draft')
      `).run();
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateAiEngineSettings(
  db: D1Database,
  updates: Partial<AiEngineSettings>
): Promise<AiEngineSettings> {
  const current = await getAiEngineSettings(db);

  let newProvider: AiProvider = current.provider;
  if (updates.provider !== undefined && isValidProvider(updates.provider)) {
    newProvider = updates.provider;
  }

  let newModel = current.model;
  if (updates.model !== undefined) {
    newModel = isValidModelForProvider(newProvider, updates.model)
      ? updates.model
      : getDefaultModelForProvider(newProvider);
  } else if (updates.provider !== undefined && !isValidModelForProvider(newProvider, newModel)) {
    newModel = getDefaultModelForProvider(newProvider);
  }

  const autoEnabled = updates.auto_generation_enabled !== undefined
    ? (updates.auto_generation_enabled ? 1 : 0)
    : (current.auto_generation_enabled ? 1 : 0);

  const dailyCount = updates.daily_count !== undefined
    ? Math.max(1, Math.min(5, Number(updates.daily_count)))
    : current.daily_count;

  const scheduleTime = typeof updates.schedule_time === "string" && /^\d{2}:\d{2}$/.test(updates.schedule_time)
    ? updates.schedule_time
    : current.schedule_time;

  const timezone = typeof updates.timezone === "string" && updates.timezone.trim()
    ? updates.timezone.trim()
    : current.timezone;

  const saveMode = updates.save_mode === "published" ? "published" : "draft";

  await db.prepare(`
    UPDATE ai_engine_settings
    SET provider = ?,
        model = ?,
        auto_generation_enabled = ?,
        daily_count = ?,
        schedule_time = ?,
        timezone = ?,
        save_mode = ?,
        updated_at = datetime('now')
    WHERE id = 1
  `).bind(
    newProvider,
    newModel,
    autoEnabled,
    dailyCount,
    scheduleTime,
    timezone,
    saveMode
  ).run();

  return getAiEngineSettings(db);
}

export async function recordAiEngineRun(
  db: D1Database,
  run: { status: "success" | "failed"; message: string; articleSlug?: string }
): Promise<void> {
  try {
    await db.prepare(`
      UPDATE ai_engine_settings
      SET last_run_at = datetime('now'),
          last_run_status = ?,
          last_run_message = ?,
          last_article_slug = COALESCE(?, last_article_slug),
          updated_at = datetime('now')
      WHERE id = 1
    `).bind(run.status, run.message, run.articleSlug || null).run();
  } catch (err) {
    console.error("recordAiEngineRun failed:", err);
  }
}

export async function recordAiEngineTest(
  db: D1Database,
  test: { status: "success" | "failed"; message: string }
): Promise<void> {
  try {
    await db.prepare(`
      UPDATE ai_engine_settings
      SET last_test_at = datetime('now'),
          last_test_status = ?,
          last_test_message = ?,
          updated_at = datetime('now')
      WHERE id = 1
    `).bind(test.status, test.message).run();
  } catch (err) {
    console.error("recordAiEngineTest failed:", err);
  }
}
