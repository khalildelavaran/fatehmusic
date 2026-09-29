const DEFAULT_SITE_URL = "https://fatehmusic.ir";

function site(value) {
  return String(value || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function daysAgo(days, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function canonicalPage(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return raw.replace(/\/$/, "");
  }
}

export async function getRecentSearchConsoleRows(db, siteUrl = DEFAULT_SITE_URL, { days = 60, maxRows = 100000 } = {}) {
  if (!db) return [];
  const result = await db.prepare(
    "SELECT query, page, clicks, impressions, ctr, position, start_date AS startDate, end_date AS endDate, data_state AS dataState, country, device, search_appearance AS searchAppearance, snapshot_label AS snapshotLabel " +
    "FROM gsc_search_signals_v2 " +
    "WHERE site_url = ? AND start_date >= ? AND snapshot_label IN ('current', 'previous') AND country = '' AND device = '' AND search_appearance = '' " +
    "ORDER BY start_date DESC, impressions DESC LIMIT ?"
  ).bind(site(siteUrl), daysAgo(days), Math.max(1, Math.min(maxRows, 100000))).all();
  return (result.results || []).map((row) => ({
    query: row.query || null,
    page: canonicalPage(row.page),
    clicks: Number(row.clicks) || 0,
    impressions: Number(row.impressions) || 0,
    ctr: Number(row.ctr) || 0,
    position: Number(row.position) || 0,
    startDate: row.startDate || null,
    endDate: row.endDate || null,
    dataState: row.dataState || null,
    country: row.country || "",
    device: row.device || "",
    searchAppearance: row.searchAppearance || "",
    snapshotLabel: row.snapshotLabel || "legacy"
  }));
}

export async function getLatestGscSyncRun(db, siteUrl = DEFAULT_SITE_URL) {
  if (!db) return null;
  const row = await db.prepare(
    "SELECT r.id, r.site_url AS siteUrl, r.start_date AS startDate, r.end_date AS endDate, r.status, r.rows_received AS rowsReceived, r.rows_stored AS rowsStored, r.truncated, r.started_at AS startedAt, r.finished_at AS finishedAt, r.error_message AS errorMessage, " +
    "(SELECT MAX(s.synced_at) FROM gsc_search_signals_v2 s WHERE s.site_url = r.site_url AND s.snapshot_label = 'current') AS snapshotSyncedAt " +
    "FROM gsc_sync_runs r WHERE r.site_url = ? ORDER BY r.started_at DESC LIMIT 1"
  ).bind(site(siteUrl)).first();
  return row || null;
}

export async function getGscPagePerformance(db, siteUrl = DEFAULT_SITE_URL, { days = 60, limit = 50 } = {}) {
  const rows = await getRecentSearchConsoleRows(db, siteUrl, { days, maxRows: 100000 });
  const labeled = rows.filter((row) => {
    const label = String(row.snapshotLabel || "");
    return label === "current" || label === "previous";
  });
  const currentRows = labeled.some((row) => row.snapshotLabel === "current")
    ? labeled.filter((row) => row.snapshotLabel === "current")
    : rows;
  const map = new Map();
  for (const row of currentRows) {
    if (!row.page) continue;
    const current = map.get(row.page) || {
      page: row.page,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
      positionImpressions: 0
    };
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    const position = Number(row.position);
    if (row.impressions > 0 && Number.isFinite(position) && position > 0) {
      current.weightedPosition += row.impressions * position;
      current.positionImpressions += row.impressions;
    }
    map.set(row.page, current);
  }
  return [...map.values()]
    .map((item) => ({
      page: item.page,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.impressions ? item.clicks / item.impressions : 0,
      position: item.positionImpressions ? item.weightedPosition / item.positionImpressions : null
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}
