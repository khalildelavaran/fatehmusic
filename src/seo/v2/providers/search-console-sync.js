import { createGoogleSearchConsoleClient } from "./search-console-client.js";

const DEFAULT_PAGE_SIZE = 25000;
const DEFAULT_MAX_ROWS = 100000;

function toRow(keys = [], dimensions = ["query", "page"], metrics = {}, { startDate, endDate } = {}) {
  const values = Object.fromEntries(dimensions.map((dimension, index) => [dimension, keys[index] || null]));
  return {
    query: values.query,
    page: values.page,
    clicks: Number(metrics.clicks) || 0,
    impressions: Number(metrics.impressions) || 0,
    ctr: Number(metrics.ctr) || 0,
    position: Number(metrics.position) || 0,
    startDate: startDate || null,
    endDate: endDate || null,
    dataState: metrics.dataState || metrics.data_state || null
  };
}

/** Fetch all available rows for a date range, paging within Search Console's row limit. */
export async function fetchAllSearchAnalytics(client, {
  startDate,
  endDate,
  dimensions = ["query", "page"],
  pageSize = DEFAULT_PAGE_SIZE,
  maxRows = DEFAULT_MAX_ROWS,
  dataState = "final"
} = {}) {
  if (!client?.configured) return { configured: false, rows: [], pages: 0 };
  const rows = [];
  let startRow = 0;
  let pages = 0;

  while (rows.length < maxRows) {
    const result = await client.querySearchAnalytics({ startDate, endDate, dimensions, rowLimit: Math.min(pageSize, maxRows - rows.length), startRow, dataState });
    pages += 1;
    const batch = (result.rows || []).map((row) => toRow(row.keys, dimensions, row, { startDate, endDate }));
    rows.push(...batch);
    if (batch.length < Math.min(pageSize, maxRows - rows.length + batch.length)) break;
    startRow += batch.length;
  }

  return { configured: true, rows, pages };
}

/**
 * Sync Search Console into D1. The function is intentionally injectable so
 * routes, scheduled workers, and tests can share exactly the same behavior.
 */
export async function syncSearchConsoleToD1({ db, env = {}, startDate, endDate, dimensions = ["query", "page"], pageSize = DEFAULT_PAGE_SIZE, maxRows = DEFAULT_MAX_ROWS, now = "datetime('now')" } = {}) {
  if (!db) throw new Error("GSC_D1_REQUIRED");
  if (!startDate || !endDate) throw new Error("GSC_DATE_RANGE_REQUIRED");

  const client = createGoogleSearchConsoleClient({
    clientEmail: env.GSC_CLIENT_EMAIL,
    privateKey: env.GSC_PRIVATE_KEY,
    siteUrl: env.GSC_SITE_URL
  });

  if (!client.configured) return { status: "not_configured", rowsReceived: 0, rowsStored: 0 };

  const run = await db.prepare(`INSERT INTO gsc_sync_runs (site_url, start_date, end_date, status) VALUES (?, ?, ?, 'running')`).bind(env.GSC_SITE_URL, startDate, endDate).run();
  const runId = run.meta?.last_row_id || null;

  try {
    const fetched = await fetchAllSearchAnalytics(client, { startDate, endDate, dimensions, pageSize, maxRows });
    let rowsStored = 0;

    for (const row of fetched.rows) {
      await db.prepare(`INSERT INTO gsc_search_signals (site_url, query, page, start_date, end_date, clicks, impressions, ctr, position, source, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'google-search-console', ${now}) ON CONFLICT(site_url, query, page, start_date, end_date) DO UPDATE SET clicks=excluded.clicks, impressions=excluded.impressions, ctr=excluded.ctr, position=excluded.position, synced_at=excluded.synced_at`).bind(env.GSC_SITE_URL, row.query, row.page, startDate, endDate, row.clicks, row.impressions, row.ctr, row.position).run();
      rowsStored += 1;
    }

    if (runId) await db.prepare(`UPDATE gsc_sync_runs SET status='success', rows_received=?, rows_stored=?, finished_at=${now} WHERE id=?`).bind(fetched.rows.length, rowsStored, runId).run();
    return { status: "success", rowsReceived: fetched.rows.length, rowsStored, pages: fetched.pages };
  } catch (error) {
    if (runId) await db.prepare(`UPDATE gsc_sync_runs SET status='failed', error_message=?, finished_at=${now} WHERE id=?`).bind(error instanceof Error ? error.message : "GSC_SYNC_FAILED", runId).run();
    throw error;
  }
}
