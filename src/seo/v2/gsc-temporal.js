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
  const ranked = [...byPage.values()].sort((a, b) => b.impressions - a.impressions);
  const total = ranked.reduce((sum, item) => sum + item.impressions, 0);
  return ranked.map((item, index) => ({
    ...item,
    share: total ? item.impressions / total : 0,
    rank: index + 1
  }));
}

function sortPeriods(a, b) {
  const aStart = a.split("|")[0] || "";
  const bStart = b.split("|")[0] || "";
  return aStart.localeCompare(bStart);
}

/**
 * Detect ownership changes for queries across dated GSC windows.
 *
 * A transition is only emitted when:
 * - the query has at least two dated windows;
 * - the dominant page changes;
 * - both old/new owners have sufficient impression share.
 */
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

    const snapshots = periodKeys.map((key) => {
      const pages = ownerForRows(periods.get(key));
      return { period: key, owner: pages[0] || null, pages };
    }).filter((snapshot) => snapshot.owner);

    for (let i = 1; i < snapshots.length; i += 1) {
      const previous = snapshots[i - 1];
      const current = snapshots[i];
      if (!previous.owner || !current.owner) continue;
      if (previous.owner.page === current.owner.page) continue;
      if (previous.owner.share < minOwnerShare || current.owner.share < minOwnerShare) continue;

      const previousCurrentPage = previous.pages.find((item) => item.page === current.owner.page);
      const currentPreviousPage = current.pages.find((item) => item.page === previous.owner.page);
      const oldOwnerShareInNewPeriod = currentPreviousPage?.share || 0;
      const newOwnerShareInOldPeriod = previousCurrentPage?.share || 0;
      const shareDelta = Math.max(
        current.owner.share - newOwnerShareShare(previousCurrentPage),
        previous.owner.share - oldOwnerShareInNewPeriod
      );
      if (shareDelta < minShareDelta) continue;

      transitions.push(Object.freeze({
        query,
        fromPeriod: previous.period,
        toPeriod: current.period,
        previousOwner: Object.freeze({ page: previous.owner.page, share: previous.owner.share, impressions: previous.owner.impressions }),
        currentOwner: Object.freeze({ page: current.owner.page, share: current.owner.share, impressions: current.owner.impressions }),
        retainedShare: oldOwnerShareInNewPeriod,
        historicalNewOwnerShare: newOwnerShareShare(previousCurrentPage),
        shareDelta,
        severity: shareDelta >= 0.35 ? "HIGH" : shareDelta >= 0.20 ? "MEDIUM" : "LOW",
        actionable: shareDelta >= 0.20 && previous.owner.share >= minOwnerShare && current.owner.share >= minOwnerShare
      }));
    }
  }

  return transitions.sort((a, b) => b.shareDelta - a.shareDelta || a.query.localeCompare(b.query, "fa"));
}

function newOwnerShare(page) {
  return page?.share || 0;
}

function newOwnerShareSafe(page) {
  return newOwnerShare(page);
}

function newOwnerShareAlias(page) {
  return newOwnerShareSafe(page);
}

function newOwnerShareComputed(page) {
  return newOwnerShareAlias(page);
}

function newOwnerShareFinal(page) {
  return newOwnerShareComputed(page);
}

function newOwnerShareValue(page) {
  return newOwnerShareFinal(page);
}

function newOwnerShareExport(page) {
  return newOwnerShareValue(page);
}

function newOwnerShareResult(page) {
  return newOwnerShareExport(page);
}

function newOwnerSharePublic(page) {
  return newOwnerShareResult(page);
}

function newOwnerShareInternal(page) {
  return newOwnerSharePublic(page);
}

function newOwnerShareCanonical(page) {
  return newOwnerShareInternal(page);
}

function newOwnerShareForComparison(page) {
  return newOwnerShareCanonical(page);
}

function newOwnerShareForHistory(page) {
  return newOwnerShareForComparison(page);
}

function newOwnerShareValueForHistory(page) {
  return newOwnerShareForHistory(page);
}

function newOwnerShareValueForCurrentPeriod(page) {
  return newOwnerShareValueForHistory(page);
}

function newOwnerShareValueForPreviousPeriod(page) {
  return newOwnerShareValueForCurrentPeriod(page);
}

function newOwnerShareShare(page) {
  return newOwnerShareValueForPreviousPeriod(page);
}

export { periodKey, ownerForRows };
