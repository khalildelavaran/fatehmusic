/** @param {D1Database} db @param {{actionType:string,targetUrl?:string|null,targetSlug?:string|null,targetTitle?:string|null,relatedCourseSlug?:string|null,recommendationScore?:number|null,status?:string,source?:string,notes?:string|null}} [options] */
export async function createSeoAction(db, {
  actionType,
  targetUrl,
  targetSlug,
  targetTitle,
  relatedCourseSlug = null,
  recommendationScore = null,
  status = "pending_review",
  source = "seo-engine",
  notes = null
} = {}) {
  if (!db) throw new Error("SEO_ACTION_DB_REQUIRED");
  const result = await db.prepare(
    "INSERT INTO seo_action_log (action_type, target_url, target_slug, target_title, related_course_slug, recommendation_score, status, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(actionType, targetUrl, targetSlug, targetTitle, relatedCourseSlug, recommendationScore, status, source, notes).run();
  return Number(result.meta?.last_row_id || 0);
}

/** @param {D1Database} db @param {{targetUrl?:string,targetSlug?:string,targetTitle?:string,previousTargetSlug?:string|null,previousTargetTitle?:string|null,publishedAt?:string}} [options] */
export async function markSeoActionPublished(db, {
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
    "WHERE status IN ('pending_review', 'measuring', 'published') AND (" +
      "(target_slug IS NOT NULL AND target_slug != '' AND target_slug IN (?, ?)) OR " +
      "((target_slug IS NULL OR target_slug = '') AND target_title IN (?, ?))" +
    ") ORDER BY CASE " +
      "WHEN target_slug = ? THEN 0 WHEN target_slug = ? THEN 1 ELSE 2 END, " +
      "updated_at DESC, id DESC LIMIT 1"
  ).bind(
    targetSlug,
    previousTargetSlug || "",
    targetTitle,
    previousTargetTitle || "",
    targetSlug,
    previousTargetSlug || ""
  ).first<{ id: number }>();

  if (!row?.id) return 0;

  const result = await db.prepare(
    "UPDATE seo_action_log SET status = 'published', target_url = COALESCE(?, target_url), " +
    "target_slug = COALESCE(NULLIF(?, ''), target_slug), target_title = COALESCE(NULLIF(?, ''), target_title), " +
    "published_at = COALESCE(published_at, ?), updated_at = datetime('now') WHERE id = ?"
  ).bind(targetUrl, targetSlug, targetTitle, publishedAt, row.id).run();

  return Number(result.meta?.changes || 0);
}

/** @param {D1Database} db @param {{siteUrl?:string,windowStart?:string,windowEnd?:string,measuredAt?:string}} [options] */
export async function syncPublishedSeoActionMeasurements(db, {
  siteUrl = "https://fatehmusic.ir",
  windowStart,
  windowEnd,
  measuredAt = new Date().toISOString()
} = {}) {
  if (!db || !windowStart || !windowEnd) return { measured: 0 };

  const site = String(siteUrl).replace(/\/$/, "");
  const rows = await db.prepare(
    "SELECT a.id, a.target_url, " +
    "COALESCE(SUM(g.impressions), 0) AS impressions, COALESCE(SUM(g.clicks), 0) AS clicks, " +
    "CASE WHEN COALESCE(SUM(g.impressions), 0) > 0 THEN COALESCE(SUM(g.clicks), 0) / SUM(g.impressions) ELSE 0 END AS ctr, " +
    "CASE WHEN COALESCE(SUM(g.impressions), 0) > 0 THEN SUM(g.impressions * g.position) / SUM(g.impressions) ELSE NULL END AS position " +
    "FROM seo_action_log a LEFT JOIN gsc_search_signals_v2 g " +
    "ON g.site_url = ? AND g.start_date = ? AND g.end_date = ? AND g.country = '' AND g.device = '' AND g.search_appearance = '' " +
    "AND lower(rtrim(g.page, '/')) = lower(rtrim(a.target_url, '/')) " +
    "WHERE a.status = 'published' AND a.target_url IS NOT NULL GROUP BY a.id, a.target_url"
  ).bind(site, windowStart, windowEnd).all();

  const measurementRows = rows.results || [];
  let measured = 0;

  for (let offset = 0; offset < measurementRows.length; offset += 50) {
    const chunk = measurementRows.slice(offset, offset + 50);
    const statements = chunk.map((row) => {
      const impressions = Number(row.impressions) || 0;
      const clicks = Number(row.clicks) || 0;
      return db.prepare(
        "INSERT INTO seo_action_measurements (action_id, measured_at, window_start, window_end, impressions, clicks, ctr, position, source) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'google-search-console') " +
        "ON CONFLICT(action_id, window_start, window_end) DO UPDATE SET measured_at=excluded.measured_at, impressions=excluded.impressions, clicks=excluded.clicks, ctr=excluded.ctr, position=excluded.position"
      ).bind(
        row.id,
        measuredAt,
        windowStart,
        windowEnd,
        impressions,
        clicks,
        Number(row.ctr) || 0,
        row.position == null ? null : Number(row.position)
      );
    });

    if (statements.length) await db.batch(statements);
    measured += chunk.length;
  }

  return { measured };
}

/** @param {D1Database} db @param {{limit?:number}} [options] */
export async function listSeoActions(db, { limit = 20 } = {}) {
  if (!db) return [];

  const actions = await db.prepare(
    "SELECT id, action_type AS actionType, target_url AS target_url, target_slug AS target_slug, target_title AS target_title, " +
    "related_course_slug AS related_course_slug, recommendation_score AS recommendation_score, status, source, " +
    "created_at AS created_at, updated_at AS updated_at, published_at AS published_at " +
    "FROM seo_action_log ORDER BY updated_at DESC LIMIT ?"
  ).bind(Math.max(1, Math.min(limit, 100))).all();

  const actionRows = actions.results || [];
  if (!actionRows.length) return [];

  const placeholders = actionRows.map(() => "?").join(",");
  const measurements = await db.prepare(
    "SELECT action_id AS actionId, measured_at AS measuredAt, window_start AS windowStart, window_end AS windowEnd, impressions, clicks, ctr, position " +
    "FROM seo_action_measurements WHERE action_id IN (" + placeholders + ") ORDER BY measured_at DESC"
  ).bind(...actionRows.map((action) => action.id)).all();

  const measurementsByAction = new Map();
  for (const row of measurements.results || []) {
    const list = measurementsByAction.get(row.actionId) || [];
    if (list.length < 2) list.push(row);
    measurementsByAction.set(row.actionId, list);
  }

  return actionRows.map((action) => {
    const list = measurementsByAction.get(action.id) || [];
    const latest = list[0] || null;
    const previous = list[1] || null;
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
        : null
    };
  });
}
