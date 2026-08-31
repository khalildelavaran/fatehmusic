/**
 * Temporal cannibalization analysis built on top of the existing GSC resolver.
 * Detects changes in query ownership across dated Search Console windows.
 */
import { normalizeText, normalizeUrl } from "./gsc-signal-resolver.js";

function numeric(value) {
  return Math.max(0, Number(value) || 0);
}

function periodKey(row) {
  const start = String(row?.startDate || row?.start_date || "").trim();
  const end = String(row?.endDate || row?.end_date || "").trim();
  if (!start && !end) return null;
  return `${start}|${end}`;
}

function ownerForRows(rows = []) {
  const byPage = new Map();
  for (const row of rows) {
    const page = normalizeUrl(row.page);
    if (!page) continue;
    const current = byPage.get(page) || { page, impressions: 0, clicks: 0 };
    current.impressions += numeric(row.impressions);
    current.clicks += numeric(row.clicks);
    byPage.set(page, current);
  }
  const ranked = [...byPage.values()].sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.page.localeCompare(b.page));
  const total = ranked.reduce((sum, item) => sum + item.impressions, 0);
  return ranked.map((item, index) => ({ ...item, share: total ? item.impressions / total : 0, rank: index + 1 }));
}

function sortPeriods(a, b) {
  return (a.split("|")[0] || "").localeCompare(b.split("|")[0] || "");
}

export function detectTemporalCannibalization(rows = [], {
  minImpressions = 50,
  minOwnerShare = 0.20,
  minShareDelta = 0.15
} = {}) {
  const queryPeriods = new Map();
  for (const row of rows) {
    const query = normalizeText(row.query);
    const period = periodKey(row);
    if (!query || !period || numeric(row.impressions) < minImpressions) continue;
    const periods = queryPeriods.get(query) || new Map();
    const bucket = periods.get(period) || [];
    bucket.push(row);
    periods.set(period, bucket);
    queryPeriods.set(query, periods);
  }

  const transitions = [];
  for (const [query, periods] of queryPeriods) {
    const periodKeys = [...periods.keys()].sort(sortPeriods);
    if (periodKeys.length < 2) continue;

    const snapshots = periodKeys.map((period) => ({ period, pages: ownerForRows(periods.get(period)) }))
      .filter((snapshot) => snapshot.pages.length > 0);

    for (let i = 1; i < snapshots.length; i += 1) {
      const previous = snapshots[i - 1];
      const current = snapshots[i];
      const previousOwner = previous.pages[0];
      const currentOwner = current.pages[0];
      if (!previousOwner || !currentOwner || previousOwner.page === currentOwner.page) continue;
      if (previousOwner.share < minOwnerShare || currentOwner.share < minOwnerShare) continue;

      const historicalNewOwnerShare = previous.pages.find((item) => item.page === currentOwner.page)?.share || 0;
      const retainedPreviousOwnerShare = current.pages.find((item) => item.page === previousOwner.page)?.share || 0;
      const previousLoss = previousOwner.share - retainedPreviousOwnerShare;
      const currentGain = currentOwner.share - historicalNewOwnerShare;
      const shareDelta = Math.max(previousLoss, currentGain);
      if (shareDelta < minShareDelta) continue;

      transitions.push(Object.freeze({
        query,
        fromPeriod: previous.period,
        toPeriod: current.period,
        previousOwner: Object.freeze({ page: previousOwner.page, share: previousOwner.share, impressions: previousOwner.impressions }),
        currentOwner: Object.freeze({ page: currentOwner.page, share: currentOwner.share, impressions: currentOwner.impressions }),
        retainedShare: retainedPreviousOwnerShare,
        historicalNewOwnerShare,
        shareDelta,
        severity: shareDelta >= 0.35 ? "HIGH" : shareDelta >= 0.20 ? "MEDIUM" : "LOW",
        actionable: shareDelta >= 0.20
      }));
    }
  }

  return transitions.sort((a, b) => b.shareDelta - a.shareDelta || a.query.localeCompare(b.query, "fa"));
}

export { periodKey, ownerForRows };
