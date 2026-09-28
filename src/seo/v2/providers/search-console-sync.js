import { createGoogleSearchConsoleClient } from "./search-console-client.js";

// Conservative defaults for a Workers Free account. D1 counts each SQL
// statement inside db.batch() toward the per-invocation query limit.
const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_ROWS = 350;
const BATCH_SIZE = 25;

function normalizeSiteUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

function toRow(keys = [], dimensions = ["query", "page"], metrics = {}, { startDate, endDate, dataState } = {}) {
  const values = Object.fromEntries(dimensions.map((dimension, index) => [dimension, keys[index] || ""]));
  return {
    query: values.query || null,
    page: values.page || null,
    country: values.country || "",
    device: values.device || "",
    searchAppearance: values.searchAppearance || "",
    clicks: Number(metrics.clicks) || 0,
    impressions: Number(metrics.impressions) || 0,
    ctr: Number(metrics.ctr) || 0,
    position: Number(metrics.position) || 0,
    startDate: startDate || null,
    endDate: endDate || null,
    dataState: dataState || "final"
  };
}

export async function fetchAllSearchAnalytics(client, {
  startDate,
  endDate,
  dimensions = ["query", "page"],
  pageSize = DEFAULT_PAGE_SIZE,
  maxRows = DEFAULT_MAX_ROWS,
  dataState = "final"
} = {}) {
  if (!client?.configured) return { configured: false, rows: [], pages: 0 };
  if (!startDate || !endDate) throw new Error("GSC_DATE_RANGE_REQUIRED");

  const rows = [];
  let startRow = 0;
  let pages = 0;
  let truncated = false;

  while (rows.length < maxRows) {
    const rowLimit = Math.min(pageSize, maxRows - rows.length);
    const result = await client.querySearchAnalytics({
      startDate,
      endDate,
      dimensions,
      rowLimit,
      startRow,
      dataState
    });
    pages += 1;
    const batch = (result.rows || []).map((row) =>
      toRow(row.keys, dimensions, row, { startDate, endDate, dataState })
    );
    rows.push(...batch);
    if (batch.length < rowLimit) break;
    startRow += batch.length;
  }

  // The Search Console API can return exactly maxRows without telling us
  // whether more rows exist. Probe one additional row when the cap is hit so
  // the caller can surface incomplete data instead of treating it as complete.
  if (rows.length >= maxRows) {
    const probe = await client.querySearchAnalytics({
      startDate,
      endDate,
      dimensions,
      rowLimit: 1,
      startRow: rows.length,
      dataState
    });
    pages += 1;
    truncated = (probe.rows || []).length > 0;
  }

  return { configured: true, rows: rows.slice(0, maxRows), pages, truncated };
}

const SNAPSHOT_LABELS = new Set([
  "current",
  "previous",
  "breakdowns-current",
  "staging-current",
  "staging-previous",
  "staging-breakdowns-current"
]);

async function storeRows(
  db,
  env,
  rows,
  startDate,
  endDate,
  snapshotLabel,
  now = "datetime('now')",
  tableName = "gsc_search_signals_v2"
) {
  const siteUrl = normalizeSiteUrl(env.GSC_SITE_URL);
  if (
    !SNAPSHOT_LABELS.has(snapshotLabel) &&
    !/^staging-(?:current|previous|breakdowns-current)-\d+$/.test(snapshotLabel)
  ) {
    throw new Error("GSC_SNAPSHOT_LABEL_INVALID");
  }
  let rowsStored = 0;

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const chunk = rows.slice(offset, offset + BATCH_SIZE);
    const statements = chunk.map((row) =>
      const conflictTarget = tableName === "gsc_search_signals_staging"
        ? "site_url, query, page, country, device, search_appearance, start_date, end_date, snapshot_label"
        : "site_url, query, page, country, device, search_appearance, start_date, end_date";
      db.prepare(
        "INSERT INTO " + tableName + " " +
        "(site_url, query, page, country, device, search_appearance, start_date, end_date, data_state, clicks, impressions, ctr, position, source, synced_at, snapshot_label) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google-search-console', " + now + ", ?) " +
        "ON CONFLICT(" + conflictTarget + ") DO UPDATE SET " +
        "data_state=excluded.data_state, clicks=excluded.clicks, impressions=excluded.impressions, ctr=excluded.ctr, " +
        "position=excluded.position, synced_at=excluded.synced_at, snapshot_label=excluded.snapshot_label"
      ).bind(
        siteUrl,
        row.query,
        row.page,
        row.country,
        row.device,
        row.searchAppearance,
        startDate,
        endDate,
        row.dataState,
        row.clicks,
        row.impressions,
        row.ctr,
        row.position,
        snapshotLabel
      )
    );

    const results = await db.batch(statements);
    rowsStored += results.reduce((sum, result) => sum + Number(result.meta?.changes || 0), 0);
  }

  return rowsStored;
}

export async function syncSearchConsoleToD1({
  db,
  env = {},
  startDate,
  endDate,
  dimensions = ["query", "page"],
  pageSize = DEFAULT_PAGE_SIZE,
  maxRows = DEFAULT_MAX_ROWS,
  dataState = "final",
  snapshotLabel = "current"
} = {}) {
  if (!db) throw new Error("GSC_D1_REQUIRED");
  if (!startDate || !endDate) throw new Error("GSC_DATE_RANGE_REQUIRED");

  const client = createGoogleSearchConsoleClient({
    clientEmail: env.GSC_CLIENT_EMAIL,
    privateKey: env.GSC_PRIVATE_KEY,
    siteUrl: env.GSC_SITE_URL
  });

  if (!client.configured) return { status: "not_configured", rowsReceived: 0, rowsStored: 0 };

  const run = await db.prepare(
    "INSERT INTO gsc_sync_runs (site_url, start_date, end_date, status, truncated) VALUES (?, ?, ?, 'running', 0)"
  ).bind(normalizeSiteUrl(env.GSC_SITE_URL), startDate, endDate).run();

  const runId = run.meta?.last_row_id || null;

  try {
    const fetched = await fetchAllSearchAnalytics(client, {
      startDate,
      endDate,
      dimensions,
      pageSize,
      maxRows,
      dataState
    });

    if (fetched.rows.length === 0) {
      // An empty API response is not enough evidence to erase a last-known-good
      // snapshot. Keep the previous snapshot and let consumers continue using it.
      if (runId) {
        await db.prepare(
          "UPDATE gsc_sync_runs SET status='success', rows_received=0, rows_stored=0, truncated=?, finished_at=datetime('now') WHERE id=?"
        ).bind(fetched.truncated ? 1 : 0, runId).run();
      }
      return {
        status: "empty",
        rowsReceived: 0,
        rowsStored: 0,
        pages: fetched.pages,
        truncated: Boolean(fetched.truncated),
        dimensions,
        snapshotLabel
      };
    }

    // Give each sync invocation its own staging label. Manual and scheduled
    // syncs can therefore overlap without mixing rows in the staging table.
    const stagingLabel = `staging-${snapshotLabel}-${String(runId || Date.now())}`;

    const rowsStored = await storeRows(
      db,
      env,
      fetched.rows,
      startDate,
      endDate,
      stagingLabel,
      "datetime('now')",
      "gsc_search_signals_staging"
    );

    // Atomically replace only the requested live snapshot from this run's
    // private staging set. The DELETE + INSERT + cleanup are one D1 batch.
    await db.batch([
      db.prepare(
        "DELETE FROM gsc_search_signals_v2 WHERE site_url=? AND snapshot_label=?"
      ).bind(normalizeSiteUrl(env.GSC_SITE_URL), snapshotLabel),
      db.prepare(
        "INSERT INTO gsc_search_signals_v2 " +
        "(site_url, query, page, country, device, search_appearance, start_date, end_date, data_state, clicks, impressions, ctr, position, source, synced_at, snapshot_label) " +
        "SELECT site_url, query, page, country, device, search_appearance, start_date, end_date, data_state, clicks, impressions, ctr, position, source, synced_at, ? " +
        "FROM gsc_search_signals_staging WHERE site_url=? AND snapshot_label=? " +
        "ON CONFLICT(site_url, query, page, country, device, search_appearance, start_date, end_date) DO UPDATE SET " +
        "data_state=excluded.data_state, clicks=excluded.clicks, impressions=excluded.impressions, ctr=excluded.ctr, " +
        "position=excluded.position, source=excluded.source, synced_at=excluded.synced_at, snapshot_label=excluded.snapshot_label"
      ).bind(snapshotLabel, normalizeSiteUrl(env.GSC_SITE_URL), stagingLabel),
      db.prepare(
        "DELETE FROM gsc_search_signals_staging WHERE site_url=? AND snapshot_label=?"
      ).bind(normalizeSiteUrl(env.GSC_SITE_URL), stagingLabel)
    ]);

    if (runId) {
      await db.prepare(
        "UPDATE gsc_sync_runs SET status='success', rows_received=?, rows_stored=?, truncated=?, finished_at=datetime('now') WHERE id=?"
      ).bind(fetched.rows.length, rowsStored, fetched.truncated ? 1 : 0, runId).run();
    }

    return {
      status: "success",
      rowsReceived: fetched.rows.length,
      rowsStored,
      pages: fetched.pages,
      truncated: Boolean(fetched.truncated),
      dimensions,
      snapshotLabel
    };
  } catch (error) {
    const stagingLabel = `staging-${snapshotLabel}-${String(runId || Date.now())}`;
    await db.prepare(
      "DELETE FROM gsc_search_signals_staging WHERE site_url=? AND snapshot_label=?"
    ).bind(normalizeSiteUrl(env.GSC_SITE_URL), stagingLabel).run().catch(() => undefined);
    if (runId) {
      await db.prepare(
        "UPDATE gsc_sync_runs SET status='failed', error_message=?, finished_at=datetime('now') WHERE id=?"
      ).bind(error instanceof Error ? error.message : "GSC_SYNC_FAILED", runId).run();
    }
    throw error;
  }
}

function dateDaysAgo(days, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function runScheduledSearchConsoleSync(env = {}, options = {}) {
  if (!env.GSC_CLIENT_EMAIL || !env.GSC_PRIVATE_KEY || !env.GSC_SITE_URL) {
    return { status: "not_configured", windows: [] };
  }
  if (!env.DB) throw new Error("GSC_D1_REQUIRED");

  const span = Number(options.spanDays || 28);
  const endOffset = Number(options.endOffsetDays ?? 3);
  const pageSize = Math.min(
    Math.max(Number(options.pageSize || DEFAULT_PAGE_SIZE), 1),
    25000
  );
  const requestedMaxRows = Math.max(Number(options.maxRows || DEFAULT_MAX_ROWS), 1);
  // Optional country/device breakdowns add a third set of D1 writes. Keep the
  // default total query footprint below the Free-plan per-invocation limit.
  const maxRows = String(env.GSC_SYNC_BREAKDOWNS || options.syncBreakdowns || "") === "1"
    ? Math.min(requestedMaxRows, 225)
    : Math.min(requestedMaxRows, 350);

  const currentEnd = dateDaysAgo(endOffset);
  const currentStart = dateDaysAgo(endOffset + span - 1);
  const previousEnd = dateDaysAgo(endOffset + span);
  const previousStart = dateDaysAgo(endOffset + span + span - 1);

  const windows = [];
  const syncWindow = async (label, startDate, endDate, dimensions, snapshotLabel) => {
    try {
      const result = await syncSearchConsoleToD1({
        db: env.DB,
        env,
        startDate,
        endDate,
        dimensions,
        pageSize,
        maxRows,
        dataState: "final",
        snapshotLabel
      });
      return { label, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`GSC ${label} sync failed:`, message);
      return { label, status: "failed", error: message };
    }
  };

  windows.push(await syncWindow(
    "current",
    currentStart,
    currentEnd,
    ["query", "page"],
    "current"
  ));

  windows.push(await syncWindow(
    "previous",
    previousStart,
    previousEnd,
    ["query", "page"],
    "previous"
  ));

  if (String(env.GSC_SYNC_BREAKDOWNS || options.syncBreakdowns || "") === "1") {
    windows.push(await syncWindow(
      "breakdowns-current",
      currentStart,
      currentEnd,
      ["query", "page", "country", "device"],
      "breakdowns-current"
    ));
  }

  const currentResult = windows.find((item) => item.label === "current");
  const previousResult = windows.find((item) => item.label === "previous");
  if (currentResult?.status === "success" || previousResult?.status === "success") {
    try {
      const { syncPublishedSeoActionMeasurements } = await import("../seo-action-store.js");
      if (currentResult?.status === "success") {
        await syncPublishedSeoActionMeasurements(env.DB, {
          siteUrl: normalizeSiteUrl(env.GSC_SITE_URL),
          windowStart: currentStart,
          windowEnd: currentEnd
        });
      }
      if (previousResult?.status === "success") {
        await syncPublishedSeoActionMeasurements(env.DB, {
          siteUrl: normalizeSiteUrl(env.GSC_SITE_URL),
          windowStart: previousStart,
          windowEnd: previousEnd,
          snapshotLabel: "previous"
        });
      }
    } catch (error) {
      console.error("GSC action measurement sync failed:", error);
    }
  }

  const failedWindows = windows.filter((item) => item.status === "failed");
  const overallStatus =
    currentResult?.status === "failed"
      ? "failed"
      : currentResult?.status === "empty"
        ? (failedWindows.length ? "partial" : "empty")
        : (failedWindows.length ? "partial" : "success");

  return {
    status: overallStatus,
    windows,
    currentWindow: { startDate: currentStart, endDate: currentEnd },
    previousWindow: { startDate: previousStart, endDate: previousEnd }
  };
}
