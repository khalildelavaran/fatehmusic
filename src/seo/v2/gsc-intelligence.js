import { scoreOpportunities } from "./opportunity-scoring.js";
import { buildGscSignalIndex, buildQueryOwnershipMap, detectSearchCannibalization, detectSemanticQueryCannibalization, resolveOpportunitySearchSignals, normalizeUrl } from "./gsc-signal-resolver.js";
import { detectTemporalCannibalization, detectSemanticTemporalCannibalization } from "./gsc-temporal.js";
import { queryTokens } from "../helpers/query.js";

export function currentScoringRows(rows = []) {
  const current = rows.filter((row) => String(row?.snapshotLabel || row?.snapshot_label || "") === "current");
  if (current.length) return current;

  const datedRows = rows.filter((row) => row?.startDate || row?.start_date || row?.endDate || row?.end_date);
  if (!datedRows.length) return rows;

  const latestPeriod = datedRows
    .map((row) => `${String(row.startDate || row.start_date || "")}|${String(row.endDate || row.end_date || "")}`)
    .sort()
    .at(-1);

  return datedRows.filter((row) =>
    `${String(row.startDate || row.start_date || "")}|${String(row.endDate || row.end_date || "")}` === latestPeriod
  );
}

export function temporalAnalysisRows(rows = []) {
  const labelled = rows.filter((row) => {
    const label = String(row?.snapshotLabel || row?.snapshot_label || "");
    return label === "current" || label === "previous";
  });
  return labelled.length ? labelled : rows;
}

/** Enrich the unified content queue with real GSC signals when available. */
export function enrichOpportunitiesWithSearchConsole(opportunities = [], rows = [], options = {}) {
  const currentRows = currentScoringRows(rows);
  const ageDays = resolveAgeDays(options.gscDataQuality?.finishedAt);
  const freshness = ageDays == null
    ? "UNKNOWN"
    : ageDays <= 4
      ? "FRESH"
      : ageDays <= 8
        ? "AGING"
        : "STALE";
  const truncated = Boolean(options.gscDataQuality?.truncated);
  const completeness = truncated ? null : (currentRows.length ? 1 : 0);
  const coverageStatus = truncated
    ? "PARTIAL"
    : currentRows.length
      ? "COMPLETE"
      : "EMPTY";

  const gscDataQuality = Object.freeze({
    truncated,
    rows: currentRows.length,
    completeness,
    coverageStatus,
    ageDays,
    freshness
  });

  // Scoring uses only the current snapshot. The previous snapshot remains
  // available to temporal analysis so historical ownership changes are not lost.
  const scoringRows = currentScoringRows(rows);
  const index = buildGscSignalIndex(scoringRows);
  const queryOwnership = buildQueryOwnershipMap(scoringRows, {
    minImpressions: Number(options.minOwnershipImpressions) > 0 ? Number(options.minOwnershipImpressions) : 1,
    limit: Number(options.maxOwnershipQueries) > 0 ? Number(options.maxOwnershipQueries) : 50
  });
  const conflicts = detectSearchCannibalization(scoringRows, options);
  const semanticConflicts = detectSemanticQueryCannibalization(scoringRows, options);
  const temporalRows = temporalAnalysisRows(rows);
  const temporal = detectTemporalCannibalization(temporalRows, options);
  const semanticTemporal = detectSemanticTemporalCannibalization(temporalRows, options);
  const conflictByPage = new Map();
  const severityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  for (const conflict of [...conflicts, ...semanticConflicts.map((conflict) => ({
    ...conflict,
    mode: "SEMANTIC_CLUSTER",
    query: conflict.query
  }))]) {
    for (const page of conflict.pages) {
      const signal = {
        query: conflict.query,
        severity: conflict.severity,
        confidence: conflict.confidence,
        semanticSimilarity: conflict.semanticSimilarity,
        semanticEvidence: conflict.semanticEvidence,
        actionable: conflict.actionable
      };
      const key = normalizeUrl(page.page);
      const existing = conflictByPage.get(key);
      if (!existing ||
          (severityRank[signal.severity] || 0) > (severityRank[existing.severity] || 0) ||
          ((severityRank[signal.severity] || 0) === (severityRank[existing.severity] || 0) &&
            Number(signal.confidence || 0) > Number(existing.confidence || 0))) {
        conflictByPage.set(key, signal);
      }
    }
  }
  const temporalByPage = new Map();
  for (const transition of [...temporal, ...semanticTemporal]) {
    const payload = {
      mode: transition.mode || "EXACT_QUERY",
      query: transition.query,
      queryVariants: transition.queryVariants || undefined,
      clusterKey: transition.clusterKey || null,
      fromPeriod: transition.fromPeriod,
      toPeriod: transition.toPeriod,
      previousOwner: transition.previousOwner,
      currentOwner: transition.currentOwner,
      retainedShare: transition.retainedShare,
      historicalNewOwnerShare: transition.historicalNewOwnerShare,
      shareDelta: transition.shareDelta,
      severity: transition.severity,
      actionable: transition.actionable
    };
    for (const page of [transition.previousOwner.page, transition.currentOwner.page]) {
      const key = normalizeUrl(page);
      const existing = temporalByPage.get(key);
      if (!existing || Number(payload.shareDelta) > Number(existing.shareDelta)) {
        temporalByPage.set(key, payload);
      }
    }
  }
  const marketSignals = normalizeMarketSignals(options.marketSignals);
  const enriched = resolveOpportunitySearchSignals(opportunities, index).map((item) => {
    const page = normalizeUrl(item.url || item.targetEntity?.url || "");
    const marketSignal = resolveMarketSignal(item, marketSignals);
    return Object.freeze({
      ...item,
      cannibalization: conflictByPage.get(page) || null,
      temporalCannibalization: temporalByPage.get(page) || null,
      marketSignal,
      gscDataQuality
    });
  });
  const scored = scoreOpportunities(enriched);
  return Object.freeze({
    opportunities: Object.freeze(scored),
    signalRowCount: scoringRows.length,
    connected: scoringRows.length > 0,
    cannibalization: Object.freeze(conflicts),
    semanticCannibalization: Object.freeze(semanticConflicts),
    temporalCannibalization: Object.freeze(temporal),
    semanticTemporalCannibalization: Object.freeze(semanticTemporal),
    queryOwnership: Object.freeze(queryOwnership),
    queryClusters: Object.freeze(index.queryClusters || []),
    dataQuality: gscDataQuality,
    summary: Object.freeze({
      connected: scoringRows.length > 0,
      signalRows: scoringRows.length,
      temporalSignalRows: rows.length,
      opportunityCount: scored.length,
      searchBackedCount: scored.filter((item) => item.searchSignal?.available).length,
      marketBackedCount: scored.filter((item) => item.marketSignal?.available).length,
      optimizeExistingCount: scored.filter((item) => item.action === "OPTIMIZE_EXISTING").length,
      expandCount: scored.filter((item) => item.action === "EXPAND").length,
      mergeCount: scored.filter((item) => item.action === "MERGE_CONTENT").length,
      linkCount: scored.filter((item) => item.action === "LINK").length,
      newContentCount: scored.filter((item) => item.action === "NEW_CONTENT").length,
      temporalCannibalizationCount: temporal.length,
      temporalActionableCount: temporal.filter((item) => item.actionable).length,
      semanticTemporalCannibalizationCount: semanticTemporal.length,
      semanticTemporalActionableCount: semanticTemporal.filter((item) => item.actionable).length,
      semanticCannibalizationCount: semanticConflicts.length,
      semanticCannibalizationActionableCount: semanticConflicts.filter((item) => item.actionable).length,
      queryOwnershipCount: queryOwnership.length,
      queryClusterCount: index.queryClusters?.length || 0,
      gscCompleteness: gscDataQuality.completeness,
      gscFreshness: gscDataQuality.freshness,
      gscAgeDays: gscDataQuality.ageDays
    })
  });
}


function normalizeMarketSignals(value) {
  if (value instanceof Map) {
    return new Map(
      [...value.entries()]
        .map(([key, item]) => [normalizeText(key), item])
        .filter(([key]) => key)
    );
  }
  if (Array.isArray(value)) {
    return new Map(value
      .filter((item) => item && item.keyword)
      .map((item) => [normalizeText(item.keyword), item]));
  }
  if (value && typeof value === "object") {
    return new Map(Object.entries(value).map(([key, item]) => [normalizeText(key), item]).filter(([key]) => key));
  }
  return new Map();
}

function resolveMarketSignal(item, signals) {
  if (!signals.size) return null;

  const candidates = [
    ...(item.searchSignal?.matchedQueries || []),
    item.title,
    item.topicName,
    item.topic,
  ].filter(Boolean);

  for (const value of candidates) {
    const exact = signals.get(normalizeText(value));
    if (exact?.available) {
      return Object.freeze({
        ...exact,
        matchedKeyword: String(value),
        matchType: "EXACT"
      });
    }
  }

  const targetText = [item.title, item.topicName, item.topic, ...(item.searchSignal?.matchedQueries || [])]
    .filter(Boolean)
    .join(" ");
  const targetTokens = queryTokens(targetText);

  if (targetTokens.size < 1) return null;

  let best = null;
  for (const [keyword, signal] of signals) {
    if (!signal?.available) continue;
    const keywordTokens = queryTokens(keyword);
    if (!keywordTokens.size) continue;

    let shared = 0;
    for (const token of keywordTokens) if (targetTokens.has(token)) shared += 1;
    const keywordCoverage = shared / keywordTokens.size;
    const targetCoverage = shared / targetTokens.size;
    const union = new Set([...keywordTokens, ...targetTokens]).size;
    const similarity = union ? shared / union : 0;

    // Require the market keyword itself to be substantially represented in the
    // page/query concept, not merely one generic token in a large title.
    if (keywordCoverage < 0.5 || targetCoverage < 0.5 || similarity < 0.5) continue;

    const volume = Number(signal.estimatedVolume) || 0;
    const score =
      similarity * 100 +
      keywordCoverage * 20 +
      targetCoverage * 10 +
      Math.min(25, Math.log10(Math.max(1, volume)) * 5);

    if (!best || score > best.score) {
      best = { score, similarity, keywordCoverage, targetCoverage, signal, keyword };
    }
  }

  if (!best) return null;

  return Object.freeze({
    ...best.signal,
    matchedKeyword: best.keyword,
    matchType: "SEMANTIC",
    semanticSimilarity: Number(best.similarity.toFixed(3)),
    marketKeywordCoverage: Number(best.keywordCoverage.toFixed(3)),
    targetConceptCoverage: Number(best.targetCoverage.toFixed(3))
  });
}


function resolveAgeDays(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86400000));
}
