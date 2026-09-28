const DEFAULT_SITE_URL = "https://fatehmusic.ir";

function site(value) {
  return String(value || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function daysAgo(days, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
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
    page: row.page || null,
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
    "SELECT id, site_url AS siteUrl, start_date AS startDate, end_date AS endDate, status, rows_received AS rowsReceived, rows_stored AS rowsStored, truncated, started_at AS startedAt, finished_at AS finishedAt, error_message AS errorMessage " +
    "FROM gsc_sync_runs WHERE site_url = ? ORDER BY started_at DESC LIMIT 1"
  ).bind(site(siteUrl)).first();
  return row || null;
}

export async function getGscPagePerformance(db, siteUrl = DEFAULT_SITE_URL, { days = 60, limit = 50 } = {}) {
  const rows = await getRecentSearchConsoleRows(db, siteUrl, { days, maxRows: 100000 });
  const map = new Map();
  for (const row of rows) {
    if (!row.page) continue;
    const current = map.get(row.page) || { page: row.page, clicks: 0, impressions: 0, weightedPosition: 0 };
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    current.weightedPosition += row.impressions * row.position;
    map.set(row.page, current);
  }
  return [...map.values()]
    .map((item) => ({
      page: item.page,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.impressions ? item.clicks / item.impressions : 0,
      position: item.impressions ? item.weightedPosition / item.impressions : null
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}
