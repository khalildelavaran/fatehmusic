import { isBrandNavigationQuery } from "../helpers/query.js";
import { classifySeoActionMeasurement } from "./action-attribution.js";

/** @param {D1Database} db @param {{actionType:string,targetUrl?:string|null,targetSlug?:string|null,targetTitle?:string|null,targetPostId?:number|null,relatedCourseSlug?:string|null,recommendationScore?:number|null,status?:string,source?:string,notes?:string|null}} [options] */
export async function createSeoAction(db, {
  actionType,
  targetUrl,
  targetSlug,
  targetTitle,
  targetPostId = null,
  relatedCourseSlug = null,
  recommendationScore = null,
  status = "pending_review",
  source = "seo-engine",
  notes = null
} = {}) {
  if (!db) throw new Error("SEO_ACTION_DB_REQUIRED");
  const result = await db.prepare(
    "INSERT INTO seo_action_log (action_type, target_url, target_slug, target_title, target_post_id, related_course_slug, recommendation_score, status, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(actionType, targetUrl, targetSlug, targetTitle, targetPostId, relatedCourseSlug, recommendationScore, status, source, notes).run();
  return Number(result.meta?.last_row_id || 0);
}

/** @param {D1Database} db @param {{targetPostId?:number|null,targetUrl?:string|null,targetSlug?:string,targetTitle?:string,previousTargetSlug?:string|null,previousTargetTitle?:string|null,publishedAt?:string}} [options] */
export async function markSeoActionPublished(db, {
  targetPostId = null,
  targetUrl = null,
  targetSlug = "",
  targetTitle = "",
  previousTargetSlug = null,
  previousTargetTitle = null,
  publishedAt = new Date().toISOString()
} = {}) {
  if (!db) return 0;

  // Match either the current published identity or the identity that existed
  // on the AI draft before an editor changed its slug/title. Only one action
  // is updated so duplicate historical actions cannot all become "published".
  const row = await db.prepare(
    "SELECT id FROM seo_action_log " +
    "WHERE status IN ('pending_review', 'measuring', 'published', 'unpublished') AND (" +
      "(target_post_id = ?) OR " +
      "(target_post_id IS NULL AND (" +
        "(target_slug IS NOT NULL AND target_slug != '' AND target_slug IN (?, ?)) OR " +
        "((target_slug IS NULL OR target_slug = '') AND target_title IN (?, ?))" +
      "))" +
    ") ORDER BY CASE " +
      "WHEN target_post_id = ? THEN 0 " +
      "WHEN target_slug = ? THEN 1 " +
      "WHEN target_slug = ? THEN 2 ELSE 3 END, " +
      "updated_at DESC, id DESC LIMIT 1"
  ).bind(
    targetPostId,
    targetSlug,
    previousTargetSlug || "",
    targetTitle,
    previousTargetTitle || "",
    targetPostId,
    targetSlug,
    previousTargetSlug || ""
  ).first();

  if (!row?.id) return 0;

  const result = await db.prepare(
    "UPDATE seo_action_log SET status = 'published', target_url = COALESCE(?, target_url), " +
    "target_slug = COALESCE(NULLIF(?, ''), target_slug), target_title = COALESCE(NULLIF(?, ''), target_title), " +
    "target_post_id = COALESCE(?, target_post_id), published_at = COALESCE(published_at, ?), " +
    "updated_at = datetime('now') WHERE id = ?"
  ).bind(targetUrl, targetSlug, targetTitle, targetPostId, publishedAt, row.id).run();

  return Number(result.meta?.changes || 0);
}

/** @param {D1Database} db @param {{targetPostId?:number|null,targetSlug?:string,targetTitle?:string,status?:string}} [options] */
export async function markSeoActionUnpublished(db, {
  targetPostId = null,
  targetSlug = "",
  targetTitle = "",
  status = "unpublished"
} = {}) {
  if (!db) return 0;
  const row = await db.prepare(
    "SELECT id FROM seo_action_log WHERE status IN ('published', 'measuring', 'pending_review') AND (" +
      "(target_post_id = ?) OR " +
      "(target_post_id IS NULL AND ((target_slug = ? AND ? != '') OR (target_title = ? AND ? != '')))" +
    ") ORDER BY updated_at DESC, id DESC LIMIT 1"
  ).bind(targetPostId, targetSlug, targetSlug, targetTitle, targetTitle).first();
  if (!row?.id) return 0;

  const result = await db.prepare(
    "UPDATE seo_action_log SET status = ?, completed_at = CASE WHEN ? = 'removed' THEN datetime('now') ELSE completed_at END, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, status, row.id).run();
  return Number(result.meta?.changes || 0);
}

/** @param {D1Database} db @param {{siteUrl?:string,windowStart?:string,windowEnd?:string,measuredAt?:string,snapshotLabel?:string}} [options] */
export async function syncPublishedSeoActionMeasurements(db, {
  siteUrl = "https://fatehmusic.ir",
  windowStart,
  windowEnd,
  measuredAt = new Date().toISOString(),
  snapshotLabel = "current"
} = {}) {
  if (!db || !windowStart || !windowEnd) return { measured: 0 };

  const site = String(siteUrl).replace(/\/$/, "");
  const result = await db.prepare(
    "SELECT a.id AS action_id, " +
    "g.query, g.impressions, g.clicks, g.position " +
    "FROM seo_action_log a " +
    "LEFT JOIN gsc_search_signals_v2 g ON " +
    "g.site_url = ? AND g.start_date = ? AND g.end_date = ? AND g.snapshot_label = ? " +
    "AND g.country = '' AND g.device = '' AND g.search_appearance = '' " +
    "AND lower(rtrim(g.page, '/')) = lower(rtrim(a.target_url, '/')) " +
    "WHERE a.status = 'published' AND a.target_url IS NOT NULL " +
    "AND (a.published_at IS NULL OR date(a.published_at) <= ?)"
  ).bind(
    site,
    windowStart,
    windowEnd,
    snapshotLabel,
    windowStart
  ).all();

  const grouped = new Map();
  for (const row of result.results || []) {
    const actionId = Number(row?.action_id);
    if (!Number.isFinite(actionId) || actionId <= 0) continue;

    const current = grouped.get(actionId) || {
      actionId,
      impressions: 0,
      clicks: 0,
      weightedPosition: 0,
      positionImpressions: 0
    };

    // Use the canonical semantic Brand detector instead of a second SQL
    // allow/deny list that can silently drift from the GSC query layer.
    if (!isBrandNavigationQuery(row?.query)) {
      const impressions = Math.max(0, Number(row?.impressions) || 0);
      const clicks = Math.max(0, Number(row?.clicks) || 0);
      const position = Number(row?.position);
      current.impressions += impressions;
      current.clicks += clicks;
      if (impressions > 0 && Number.isFinite(position) && position > 0) {
        current.weightedPosition += impressions * position;
        current.positionImpressions += impressions;
      }
    }

    grouped.set(actionId, current);
  }

  if (!grouped.size) return { measured: 0 };

  const rows = [...grouped.values()].map((item) => ({
    actionId: item.actionId,
    impressions: item.impressions,
    clicks: item.clicks,
    ctr: item.impressions > 0 ? item.clicks / item.impressions : 0,
    position: item.positionImpressions > 0
      ? item.weightedPosition / item.positionImpressions
      : null
  }));

  // One multi-row upsert per bounded chunk keeps D1 statement/parameter usage
  // predictable while still recording zero-demand windows.
  const CHUNK_SIZE = 80;
  let measured = 0;
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, 'google-search-console')").join(", ");
    const sql =
      "INSERT INTO seo_action_measurements " +
      "(action_id, measured_at, window_start, window_end, impressions, clicks, ctr, position, source) " +
      "VALUES " + placeholders + " " +
      "ON CONFLICT(action_id, window_start, window_end) DO UPDATE SET " +
      "measured_at=excluded.measured_at, impressions=excluded.impressions, clicks=excluded.clicks, " +
      "ctr=excluded.ctr, position=excluded.position";

    const bindings = [];
    for (const item of chunk) {
      bindings.push(
        item.actionId,
        measuredAt,
        windowStart,
        windowEnd,
        item.impressions,
        item.clicks,
        item.ctr,
        item.position
      );
    }

    const write = await db.prepare(sql).bind(...bindings).run();
    measured += Number(write.meta?.changes || 0);
  }

  return { measured };
}

/** @param {D1Database} db @param {{limit?:number}} [options] */
export async function listSeoActions(db, { limit = 20 } = {}) {
  if (!db) return [];

  const actions = await db.prepare(
    "SELECT id, action_type AS actionType, target_url AS target_url, target_slug AS target_slug, target_title AS target_title, " +
    "target_post_id AS target_post_id, related_course_slug AS related_course_slug, recommendation_score AS recommendation_score, status, source, " +
    "created_at AS created_at, updated_at AS updated_at, published_at AS published_at " +
    "FROM seo_action_log ORDER BY updated_at DESC LIMIT ?"
  ).bind(Math.max(1, Math.min(limit, 100))).all();

  const actionRows = actions.results || [];
  if (!actionRows.length) return [];

  const placeholders = actionRows.map(() => "?").join(",");
  const measurements = await db.prepare(
    "SELECT action_id AS actionId, measured_at AS measuredAt, window_start AS windowStart, window_end AS windowEnd, impressions, clicks, ctr, position " +
    "FROM seo_action_measurements WHERE action_id IN (" + placeholders + ") " +
    "AND window_start >= date('now', '-180 days') ORDER BY window_start DESC"
  ).bind(...actionRows.map((action) => action.id)).all();

  const measurementsByAction = new Map();
  for (const row of measurements.results || []) {
    const list = measurementsByAction.get(row.actionId) || [];
    list.push(row);
    measurementsByAction.set(row.actionId, list);
  }

  return actionRows.map((action) => {
    const list = measurementsByAction.get(action.id) || [];
    const latest = list[0] || null;
    // Compare against the nearest earlier non-overlapping reporting window.
    // This avoids treating overlapping rolling 28-day snapshots as before/after.
    const previous = latest
      ? list.find((item) => String(item.windowEnd || "") < String(latest.windowStart || ""))
      : null;
    return {
      ...action,
      latest,
      previous,
      ctrDelta: latest && previous ? Number(latest.ctr) - Number(previous.ctr) : null,
      positionDelta: latest && previous && latest.position != null && previous.position != null
        ? Number(latest.position) - Number(previous.position)
        : null,
      impressionDelta: latest && previous
        ? Number(latest.impressions) - Number(previous.impressions)
        : null,
      outcome: classifySeoActionMeasurement(latest, previous)
    };
  });
}
