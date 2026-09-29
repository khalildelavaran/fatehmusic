import { classifyGscDimensionMix, sanitizeGscQueryPageRows } from "./gsc-dimensions.js";
import { scoreOpportunities } from "./opportunity-scoring.js";
import { buildGscSignalIndex, buildQueryOwnershipMapWithMeta, detectSearchCannibalization, detectSemanticQueryCannibalization, resolveOpportunitySearchSignals, normalizeUrl } from "./gsc-signal-resolver.js";
import { detectTemporalCannibalization, detectSemanticTemporalCannibalization } from "./gsc-temporal.js";
import { queryTokens, querySemanticFeatureSet } from "../helpers/query.js";
import { normalizeSemanticText } from "../helpers/text.js";

function selectCurrentGscInputRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const snapshotLabels = safeRows
    .map((row) => String(row?.snapshotLabel || row?.snapshot_label || "").trim())
    .filter(Boolean);

  // Once snapshot labels are present, the explicit current snapshot wins.
  // Do not mix previous/breakdown snapshots into live scoring.
  if (snapshotLabels.length) {
    return safeRows.filter((row) =>
      String(row?.snapshotLabel || row?.snapshot_label || "") === "current"
    );
  }

  const datedRows = safeRows.filter((row) => row?.startDate || row?.start_date || row?.endDate || row?.end_date);
  if (!datedRows.length) return safeRows;

  const latestPeriod = datedRows
    .map((row) => `${String(row.startDate || row.start_date || "")}|${String(row.endDate || row.end_date || "")}`)
    .sort()
    .at(-1);

  return datedRows.filter((row) =>
    `${String(row.startDate || row.start_date || "")}|${String(row.endDate || row.end_date || "")}` === latestPeriod
  );
}

export function currentScoringRows(rows = []) {
  const selected = selectCurrentGscInputRows(rows);
  const dimensionMix = classifyGscDimensionMix(selected);

  // Unlabelled mixed-dimensional exports are inherently ambiguous. Prefer
  // canonical query/page rows; if none exist, fail closed instead of
  // double-counting a country/device/search-appearance breakdown.
  return dimensionMix.mixed || dimensionMix.dimensionMode === "BREAKDOWN"
    ? filterCanonicalGscRows(selected)
    : selected;
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
  const selectedCurrentRows = selectCurrentGscInputRows(rows);
  const currentDimensionProfile = classifyGscDimensionMix(selectedCurrentRows);
  const currentRows = currentDimensionProfile.mixed || currentDimensionProfile.dimensionMode === "BREAKDOWN"
    ? filterCanonicalGscRows(selectedCurrentRows)
    : selectedCurrentRows;
  const ageDays = resolveAgeDays(options.gscDataQuality?.finishedAt);
  const freshness = ageDays == null
    ? "UNKNOWN"
    : ageDays <= 4
      ? "FRESH"
      : ageDays <= 8
        ? "AGING"
        : "STALE";
  const truncated = Boolean(options.gscDataQuality?.truncated);
  const reportedCompleteness = Number(options.gscDataQuality?.completeness);
  const normalizedReportedCompleteness =
    Number.isFinite(reportedCompleteness)
      ? Math.max(0, Math.min(1, reportedCompleteness))
      : null;
  const rowsReceivedValue = Number(options.gscDataQuality?.rowsReceived);
  const maxRowsValue = Number(options.gscDataQuality?.maxRows);
  const rowsReceivedNormalized =
    Number.isFinite(rowsReceivedValue) && rowsReceivedValue >= 0
      ? rowsReceivedValue
      : selectedCurrentRows.length;
  const maxRowsNormalized =
    Number.isFinite(maxRowsValue) && maxRowsValue > 0
      ? maxRowsValue
      : null;

  // A non-truncated API response proves that the requested snapshot returned
  // data without hitting our configured row ceiling; it does NOT prove that
  // every possible low-volume query was returned. Only an explicit provider
  // completeness value can legitimately make completeness numeric.
  const effectiveCoverageStatus = truncated
    ? "PARTIAL"
    : normalizedReportedCompleteness != null
      ? "COMPLETE"
      : currentRows.length
        ? "OBSERVED"
        : "EMPTY";

  const gscDataQuality = Object.freeze({
    ...currentDimensionProfile,
    truncated,
    rows: currentRows.length,
    rowsReceived: rowsReceivedNormalized,
    maxRows: maxRowsNormalized,
    completeness: normalizedReportedCompleteness,
    coverageStatus: effectiveCoverageStatus,
    coverageKnown: normalizedReportedCompleteness != null,
    coverageBasis: normalizedReportedCompleteness != null
      ? "PROVIDER_REPORTED"
      : truncated
        ? "ROW_CAP_REACHED"
        : currentRows.length
          ? "NON_EMPTY_SNAPSHOT"
          : "NO_DATA",
    ageDays,
    freshness
  });

  // Scoring uses only the current snapshot. The previous snapshot remains
  // available to temporal analysis so historical ownership changes are not lost.
  const scoringRows = currentScoringRows(rows);
  const index = options.gscIndex || buildGscSignalIndex(scoringRows, {
    queryClusterLimit: Number(options.maxQueryClusters) > 0 ? Number(options.maxQueryClusters) : 5000,
    queryClusterMinImpressions: Number(options.minQueryClusterImpressions) > 0 ? Number(options.minQueryClusterImpressions) : 1
  });
  const queryOwnershipResult = options.queryOwnershipResult || buildQueryOwnershipMapWithMeta(scoringRows, {
    minImpressions: Number(options.minOwnershipImpressions) > 0 ? Number(options.minOwnershipImpressions) : 1,
    limit: Number(options.maxOwnershipQueries) > 0 ? Number(options.maxOwnershipQueries) : 5000
  });
  const queryOwnership = queryOwnershipResult.items;
  const queryClusterTotalCount = Number(index.queryClusterTotalCount || index.queryClusters?.length || 0);
  const queryClusterLimit = Number(index.queryClusterLimit || index.queryClusters?.length || 0);
  const queryClusterTruncated = Boolean(index.queryClusterTruncated);
  const conflicts = detectSearchCannibalization(scoringRows, options);
  const semanticConflicts = detectSemanticQueryCannibalization(scoringRows, {
    ...options,
    maxQueryClusters: Number(options.maxQueryClusters) > 0 ? Number(options.maxQueryClusters) : 5000
  });
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
  const competitorGaps = Array.isArray(options.competitorGaps) ? options.competitorGaps : [];
  const competitorGapSignals = normalizeMarketSignals(competitorGaps.map((item) => ({
    ...item,
    available: true,
    keyword: item.keyword,
    source: "competitor-gap"
  })));
  const marketSignalTimestamps = [...marketSignals.values()]
    .map((item) => item?.fetchedAt || item?.fetched_at || null)
    .filter(Boolean)
    .sort();
  const marketTimestamp =
    options.marketDataQuality?.fetchedAt ||
    options.marketDataQuality?.finishedAt ||
    marketSignalTimestamps.at(-1) ||
    null;
  const marketAgeDays = resolveAgeDays(marketTimestamp);
  const marketFreshness = marketAgeDays == null
    ? "UNKNOWN"
    : marketAgeDays <= 8
      ? "FRESH"
      : marketAgeDays <= 16
        ? "AGING"
        : "STALE";
  const marketDataQuality = Object.freeze({
    configured: marketSignals.size > 0,
    signalCount: marketSignals.size,
    fetchedAt: marketTimestamp,
    ageDays: marketAgeDays,
    freshness: marketFreshness
  });
  const competitorFetchedAt = competitorGaps
    .map((item) => item?.fetchedAt || item?.fetched_at || null)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const competitorAgeDays = resolveAgeDays(competitorFetchedAt);
  const competitorFreshness = competitorAgeDays == null
    ? "UNKNOWN"
    : competitorAgeDays <= 8
      ? "FRESH"
      : competitorAgeDays <= 16
        ? "AGING"
        : "STALE";
  const competitorDataQuality = Object.freeze({
    configured: competitorGaps.length > 0,
    signalCount: competitorGaps.length,
    ageDays: competitorAgeDays,
    freshness: competitorFreshness
  });

  const temporalOwnershipByQuery = buildTemporalOwnershipQueryIndex([
    ...temporal,
    ...semanticTemporal
  ]);

  const enriched = resolveOpportunitySearchSignals(opportunities, index).map((item) => {
    const page = normalizeUrl(item.url || item.targetEntity?.url || "");
    const marketSignal = resolveMarketSignal(item, marketSignals);
    const competitorGap = resolveCompetitorGap(item, competitorGapSignals);
    const searchOwnership = enrichSearchOwnershipTemporalStability(
      item.searchOwnership,
      temporalOwnershipByQuery
    );
    return Object.freeze({
      ...item,
      searchOwnership,
      cannibalization: conflictByPage.get(page) || null,
      temporalCannibalization: temporalByPage.get(page) || null,
      marketSignal,
      competitorGap,
      gscDataQuality,
      marketDataQuality,
      competitorDataQuality
    });
  });
  const scored = scoreOpportunities(enriched);
  return Object.freeze({
    index,
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
    marketDataQuality,
    competitorDataQuality,
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
      queryOwnershipTotalCount: queryOwnershipResult.totalCount,
      queryOwnershipLimit: queryOwnershipResult.limit,
      queryOwnershipTruncated: queryOwnershipResult.truncated,
      queryClusterCount: index.queryClusters?.length || 0,
      queryClusterTotalCount,
      queryClusterLimit,
      queryClusterTruncated,
      gscCompleteness: gscDataQuality.completeness == null ? 0 : gscDataQuality.completeness,
      gscCoverageKnown: Boolean(gscDataQuality.coverageKnown),
      gscCoverageBasis: gscDataQuality.coverageBasis || "NO_DATA",
      gscCoverageStatus: gscDataQuality.coverageStatus || "EMPTY",
      gscDimensionMode: gscDataQuality.dimensionMode || "QUERY_PAGE",
      gscMixedDimensions: Boolean(gscDataQuality.mixed),
      gscCanonicalRows: Number(gscDataQuality.canonicalRows) || 0,
      gscBreakdownRowsFiltered: Number(gscDataQuality.breakdownRows) || 0,
      gscFreshness: gscDataQuality.freshness,
      gscAgeDays: gscDataQuality.ageDays,
      marketFreshness: marketDataQuality.freshness,
      marketAgeDays: marketDataQuality.ageDays,
      marketSignalCount: marketDataQuality.signalCount,
      competitorGapCount: competitorGaps.length,
      competitorGapBackedCount: scored.filter((item) => item.competitorGap?.available).length,
      competitorFreshness: competitorDataQuality.freshness,
      competitorAgeDays: competitorDataQuality.ageDays
    })
  });
}


function buildTemporalOwnershipQueryIndex(transitions = []) {
  const byQuery = new Map();
  for (const transition of Array.isArray(transitions) ? transitions : []) {
    const variants = [
      transition?.query,
      ...(Array.isArray(transition?.queryVariants) ? transition.queryVariants.map((item) => item?.query || item?.displayQuery) : [])
    ]
      .map((value) => normalizeSemanticText(value || ""))
      .filter(Boolean);

    for (const query of variants) {
      const previous = byQuery.get(query);
      const candidate = {
        severity: transition?.severity || "LOW",
        actionable: Boolean(transition?.actionable),
        shareDelta: Number(transition?.shareDelta) || 0,
        mode: transition?.mode || "EXACT_QUERY",
        fromPeriod: transition?.fromPeriod || null,
        toPeriod: transition?.toPeriod || null,
        previousOwner: transition?.previousOwner || null,
        currentOwner: transition?.currentOwner || null
      };
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (!previous ||
          (rank[candidate.severity] || 0) > (rank[previous.severity] || 0) ||
          ((rank[candidate.severity] || 0) === (rank[previous.severity] || 0) &&
            candidate.shareDelta > previous.shareDelta)) {
        byQuery.set(query, candidate);
      }
    }
  }
  return byQuery;
}

function enrichSearchOwnershipTemporalStability(ownership, temporalOwnershipByQuery) {
  if (!ownership || ownership.matchType !== "EXACT" || !temporalOwnershipByQuery?.size) return ownership;

  const transitions = (ownership.matchedQueries || [])
    .map((query) => temporalOwnershipByQuery.get(normalizeSemanticText(query)))
    .filter(Boolean)
    .sort((a, b) => {
      const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (rank[b.severity] || 0) - (rank[a.severity] || 0) ||
        Number(b.shareDelta || 0) - Number(a.shareDelta || 0);
    });

  if (!transitions.length) {
    return Object.freeze({
      ...ownership,
      temporalOwnership: Object.freeze({
        status: "STABLE",
        shiftCount: 0,
        highActionable: false
      })
    });
  }

  const strongest = transitions[0];
  return Object.freeze({
    ...ownership,
    temporalOwnership: Object.freeze({
      status: strongest.actionable ? "SHIFT" : "MONITOR",
      shiftCount: transitions.length,
      highActionable: transitions.some((item) => item.severity === "HIGH" && item.actionable),
      strongestSeverity: strongest.severity,
      strongestShareDelta: strongest.shareDelta,
      strongestMode: strongest.mode,
      fromPeriod: strongest.fromPeriod,
      toPeriod: strongest.toPeriod,
      previousOwner: strongest.previousOwner,
      currentOwner: strongest.currentOwner
    })
  });
}

function normalizeMarketSignals(value) {
  if (value instanceof Map) {
    return new Map(
      [...value.entries()]
        .map(([key, item]) => [normalizeSemanticText(key), item])
        .filter(([key]) => key)
    );
  }
  if (Array.isArray(value)) {
    return new Map(value
      .filter((item) => item && item.keyword)
      .map((item) => [normalizeSemanticText(item.keyword), item]));
  }
  if (value && typeof value === "object") {
    return new Map(Object.entries(value).map(([key, item]) => [normalizeSemanticText(key), item]).filter(([key]) => key));
  }
  return new Map();
}

function semanticFeatureMatch(left, right) {
  const leftFeatures = querySemanticFeatureSet(left);
  const rightFeatures = querySemanticFeatureSet(right);
  if (!leftFeatures.size || !rightFeatures.size) return null;

  let shared = 0;
  for (const feature of rightFeatures) {
    if (leftFeatures.has(feature)) shared += 1;
  }

  const keywordCoverage = shared / rightFeatures.size;
  const targetCoverage = shared / leftFeatures.size;
  const union = new Set([...leftFeatures, ...rightFeatures]).size;
  const similarity = union ? shared / union : 0;

  return { similarity, keywordCoverage, targetCoverage };
}

function findBestSemanticSignal(candidates, signals, {
  minKeywordCoverage = 0.6,
  minTargetCoverage = 0.5,
  minSimilarity = 0.55,
  volumeWeight = 5,
  volumeCap = 25
} = {}) {
  let best = null;

  for (const candidate of [...new Set(candidates.filter(Boolean).map(String))]) {
    const targetFeatures = querySemanticFeatureSet(candidate);
    if (!targetFeatures.size) continue;

    for (const [keyword, signal] of signals) {
      if (!signal?.available) continue;
      const match = semanticFeatureMatch(candidate, keyword);
      if (!match) continue;

      if (
        match.keywordCoverage < minKeywordCoverage ||
        match.targetCoverage < minTargetCoverage ||
        match.similarity < minSimilarity
      ) continue;

      const volume = Number(signal.estimatedVolume) || 0;
      const score =
        match.similarity * 100 +
        match.keywordCoverage * 20 +
        match.targetCoverage * 10 +
        Math.min(volumeCap, Math.log10(Math.max(1, volume)) * volumeWeight);

      if (!best || score > best.score) {
        best = { score, ...match, signal, keyword, candidate };
      }
    }
  }

  return best;
}

function resolveCompetitorGap(item, signals) {
  if (!signals?.size) return null;

  const candidates = [
    item.title,
    item.topicName,
    item.topic,
    ...(item.queryAngles || []),
    ...(item.marketQueryAngles || []),
    ...(item.searchSignal?.matchedQueries || [])
  ].filter(Boolean);

  for (const value of candidates) {
    const exact = signals.get(normalizeSemanticText(value));
    if (exact?.available) {
      return Object.freeze({
        ...exact,
        matchedKeyword: String(value),
        matchType: "EXACT"
      });
    }
  }

  const best = findBestSemanticSignal(candidates, signals, {
    minKeywordCoverage: 0.6,
    minTargetCoverage: 0.5,
    minSimilarity: 0.55,
    volumeWeight: 4,
    volumeCap: 20
  });

  if (!best) return null;

  return Object.freeze({
    ...best.signal,
    matchedKeyword: best.keyword,
    matchType: "SEMANTIC",
    semanticSimilarity: Number(best.similarity.toFixed(3)),
    competitorKeywordCoverage: Number(best.keywordCoverage.toFixed(3)),
    targetConceptCoverage: Number(best.targetCoverage.toFixed(3))
  });
}

function resolveMarketSignal(item, signals) {
  if (!signals.size) return null;

  const candidates = [
    ...(item.searchSignal?.matchedQueries || []),
    item.title,
    item.topicName,
    item.topic,
    ...(item.queryAngles || []),
    ...(item.marketQueryAngles || [])
  ].filter(Boolean);

  for (const value of candidates) {
    const exact = signals.get(normalizeSemanticText(value));
    if (exact?.available) {
      return Object.freeze({
        ...exact,
        matchedKeyword: String(value),
        matchType: "EXACT"
      });
    }
  }

  const best = findBestSemanticSignal(candidates, signals, {
    minKeywordCoverage: 0.6,
    minTargetCoverage: 0.5,
    minSimilarity: 0.55,
    volumeWeight: 5,
    volumeCap: 25
  });

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

export { classifyGscDimensionMix } from "./gsc-dimensions.js";
