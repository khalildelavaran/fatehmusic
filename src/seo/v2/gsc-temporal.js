/**
 * Temporal cannibalization analysis built on top of the existing GSC resolver.
 * Detects changes in query ownership across dated Search Console windows.
 */
import { buildSemanticQueryClusters, normalizeText, normalizeUrl, isOwnershipEligibleQuery } from "./gsc-signal-resolver.js";

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
    if (!query || !period || !isOwnershipEligibleQuery(query) || numeric(row.impressions) < minImpressions) continue;
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


export function detectSemanticTemporalCannibalization(rows = [], {
  minImpressions = 50,
  minOwnerShare = 0.20,
  minShareDelta = 0.15
} = {}) {
  const byPeriod = new Map();

  for (const row of rows) {
    const period = periodKey(row);
    const query = normalizeText(row?.query);
    if (!period || !query || !isOwnershipEligibleQuery(query)) continue;

    const bucket = byPeriod.get(period) || [];
    bucket.push(row);
    byPeriod.set(period, bucket);
  }

  const snapshots = [...byPeriod.entries()]
    .sort(([left], [right]) => sortPeriods(left, right))
    .map(([period, periodRows]) => ({
      period,
      clusters: new Map(
        buildSemanticQueryClusters(periodRows, {
          minImpressions,
          limit: 5000
        }).map((cluster) => [cluster.key, cluster])
      )
    }));

  const transitions = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const previousSnapshot = snapshots[index - 1];
    const currentSnapshot = snapshots[index];

    for (const [clusterKey, currentCluster] of currentSnapshot.clusters) {
      const previousCluster = previousSnapshot.clusters.get(clusterKey);
      if (!previousCluster || currentCluster.pageCount < 2 || previousCluster.pageCount < 1) continue;

      const previousOwner = previousCluster.pages[0];
      const currentOwner = currentCluster.pages[0];
      if (!previousOwner || !currentOwner || previousOwner.page === currentOwner.page) continue;
      if (previousOwner.share < minOwnerShare || currentOwner.share < minOwnerShare) continue;

      const historicalNewOwnerShare =
        previousCluster.pages.find((item) => item.page === currentOwner.page)?.share || 0;
      const retainedPreviousOwnerShare =
        currentCluster.pages.find((item) => item.page === previousOwner.page)?.share || 0;
      const previousLoss = previousOwner.share - retainedPreviousOwnerShare;
      const currentGain = currentOwner.share - historicalNewOwnerShare;
      const shareDelta = Math.max(previousLoss, currentGain);
      if (shareDelta < minShareDelta) continue;

      transitions.push(Object.freeze({
        mode: "SEMANTIC_CLUSTER",
        clusterKey,
        query: currentCluster.queries[0]?.displayQuery || previousCluster.queries[0]?.displayQuery || clusterKey,
        queryVariants: currentCluster.queries,
        fromPeriod: previousSnapshot.period,
        toPeriod: currentSnapshot.period,
        previousOwner: Object.freeze({
          page: previousOwner.page,
          share: previousOwner.share,
          impressions: previousOwner.impressions
        }),
        currentOwner: Object.freeze({
          page: currentOwner.page,
          share: currentOwner.share,
          impressions: currentOwner.impressions
        }),
        retainedShare: retainedPreviousOwnerShare,
        historicalNewOwnerShare,
        shareDelta,
        severity: shareDelta >= 0.35 ? "HIGH" : shareDelta >= 0.20 ? "MEDIUM" : "LOW",
        actionable: shareDelta >= 0.20,
        semanticEvidence: true
      }));
    }
  }

  return transitions.sort((a, b) => b.shareDelta - a.shareDelta || a.clusterKey.localeCompare(b.clusterKey));
}

export { periodKey, ownerForRows };
