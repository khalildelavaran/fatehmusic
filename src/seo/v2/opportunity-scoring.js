import { normalizeSemanticText } from "../helpers/text.js";

/** Unified SEO/GEO opportunity scoring. Deterministic and safe for dashboard use. */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

function decisionConfidenceEvidence(item = {}) {
  const points = [];
  const signal = item.searchSignal;
  const ownership = item.searchOwnership;

  if (signal?.available) {
    points.push(["GSC signal present", 18]);
    const queryIntent = signal.queryIntentEvidence;
    const targetIntent = String(item.searchIntent || item.intent || "").toLowerCase();
    if (queryIntent?.primary) {
      if (targetIntent && queryIntent.primary === targetIntent && Number(queryIntent.confidence || 0) >= 0.55) {
        points.push(["GSC query intent agrees with target", 6]);
      } else if (targetIntent && queryIntent.primary !== targetIntent && Number(queryIntent.confidence || 0) >= 0.70) {
        points.push(["GSC query intent conflicts with target", -5]);
      }
      if (Number(queryIntent.primaryShare || 0) < 0.50 && Number(queryIntent.queryCount || 0) >= 2) {
        points.push(["ambiguous GSC query intent", -3]);
      }
    }
    const impressions = Math.max(0, Number(signal.impressions) || 0);
    if (impressions >= 300) points.push(["GSC sample >= 300 impressions", 15]);
    else if (impressions >= 100) points.push(["GSC sample >= 100 impressions", 12]);
    else if (impressions >= 20) points.push(["GSC sample >= 20 impressions", 8]);
    else if (impressions >= 5) points.push(["GSC sample >= 5 impressions", 4]);
    else if (impressions > 0) points.push(["GSC sample is trace-level", 1]);

    if (Number.isFinite(Number(signal.position)) && Number(signal.position) > 0) {
      points.push(["GSC position available", 5]);
    }
    if (Array.isArray(signal.matchedQueries) && signal.matchedQueries.length > 0) {
      points.push(["matched query evidence", 5]);
    }
    const benchmarkSample = Number(signal.ctrBenchmarkImpressions);
    if (Number.isFinite(Number(signal.ctrBenchmark)) && Number(signal.ctrBenchmark) > 0 && benchmarkSample >= 50) {
      points.push(["position-aware CTR benchmark", 4]);
      if (benchmarkSample >= 500) points.push(["CTR benchmark sample >= 500 impressions", 3]);
      else if (benchmarkSample >= 100) points.push(["CTR benchmark sample >= 100 impressions", 2]);
    }
    if (signal.ctrInterval95?.lower != null && signal.ctrInterval95?.upper != null) {
      const width = Number(signal.ctrInterval95.upper) - Number(signal.ctrInterval95.lower);
      if (width <= 0.02) points.push(["narrow 95% CTR interval", 4]);
      else if (width <= 0.05) points.push(["usable 95% CTR interval", 2]);
    }
  }

  if (item.competitorGap?.available) {
    points.push(["competitor keyword gap", 8]);
    if (Number(item.competitorGap.competitorCount) >= 3) {
      points.push(["multiple competitors share gap", 4]);
    } else if (Number(item.competitorGap.competitorCount) >= 2) {
      points.push(["multiple competitor evidence", 2]);
    }
    if (Number(item.competitorGap.gapScore) >= 70) {
      points.push(["strong competitor gap signal", 3]);
    }
  }

  if (item.marketSignal?.available) {
    points.push(["market signal present", 10]);
    const marketIntents = item.marketSignal.intents && typeof item.marketSignal.intents === "object"
      ? (
          Array.isArray(item.marketSignal.intents)
            ? item.marketSignal.intents.map((value) => String(value).toLowerCase())
            : Object.entries(item.marketSignal.intents)
                .filter(([, value]) => Boolean(value))
                .map(([key]) => String(key).toLowerCase())
        )
      : [];
    const normalizedIntent = String(item.searchIntent || item.intent || "").toLowerCase();
    if (normalizedIntent && marketIntents.includes(normalizedIntent)) {
      points.push(["market and content intent agreement", 4]);
    }

    if (Number(item.marketSignal.estimatedVolume) > 0) points.push(["market volume available", 5]);
    if (Number.isFinite(Number(item.marketSignal.difficulty))) points.push(["market difficulty available", 3]);

    const marketAgeDays = Number(item.marketDataQuality?.ageDays);
    const marketFreshness = String(
      item.marketDataQuality?.freshness ||
      item.marketSignal.dataFreshness ||
      ""
    ).toUpperCase();
    if (marketFreshness === "FRESH" || (Number.isFinite(marketAgeDays) && marketAgeDays <= 8)) {
      points.push(["fresh market data", 3]);
    } else if (marketFreshness === "AGING" || (Number.isFinite(marketAgeDays) && marketAgeDays <= 16)) {
      points.push(["aging market data", -3]);
    } else if (marketFreshness === "STALE" || (Number.isFinite(marketAgeDays) && marketAgeDays > 16)) {
      points.push(["stale market data", -8]);
    }
    if (item.marketSignal.matchType === "EXACT") points.push(["exact market keyword match", 5]);
    else if (item.marketSignal.matchType === "SEMANTIC") points.push(["semantic market keyword match", 2]);
  }

  const intentConfidence = Number(item.intentConfidence);
  if (Number.isFinite(intentConfidence) && intentConfidence > 0) {
    points.push(["intent confidence", Math.round(Math.min(10, intentConfidence * 10))]);
  }

  if (item.semanticQueryCluster?.impressions > 0) {
    points.push(["semantic GSC query cluster", 5]);
    if (Number(item.semanticQueryCluster.queryCount) >= 2) {
      points.push(["multiple query variants in cluster", 3]);
    }
    if (item.semanticQueryCluster.ownerStatus === "STABLE") {
      if (item.semanticQueryCluster.ownerDominanceEvidence === "WEAK") {
        points.push(["weak semantic cluster ownership evidence", -2]);
      } else {
        points.push(["stable semantic cluster owner", 3]);
      }
    } else if (item.semanticQueryCluster.ownerStatus === "SPLIT") {
      points.push(["split semantic cluster ownership", -4]);
    }
  }

  if (item.searchSignal?.available && item.marketSignal?.available) {
    const marketKeyword = normalizeSemanticText(item.marketSignal.matchedKeyword || "");
    const matchedQueries = (item.searchSignal.matchedQueries || []).map((query) => normalizeSemanticText(query));
    if (
      item.marketSignal.matchType === "EXACT" &&
      marketKeyword &&
      matchedQueries.includes(marketKeyword)
    ) {
      points.push(["GSC and market exact keyword agreement", 5]);
    } else if (
      item.marketSignal.matchType === "SEMANTIC" &&
      Number(item.marketSignal.semanticSimilarity || 0) >= 0.7
    ) {
      points.push(["GSC and market semantic agreement", 3]);
    }
  }

  if (ownership?.matchType === "EXACT") {
    points.push(["exact GSC query ownership", 12]);
    if (ownership.ownerStatus === "STABLE") points.push(["stable query owner", 10]);
    if (ownership.ownerDominanceEvidence === "STRONG") points.push(["strong owner-share evidence", 4]);
    else if (ownership.ownerDominanceEvidence === "WEAK") points.push(["weak owner-share evidence", -2]);
    else if (ownership.ownerStatus === "SPLIT") points.push(["split query ownership", -8]);
    else if (ownership.ownerStatus === "EMERGING") points.push(["emerging query ownership", -3]);
  } else if (ownership?.matchType === "RELATED") {
    points.push(["related-only query evidence", 2]);
  }

  if (item.gscDataQuality?.truncated) points.push(["GSC snapshot truncated", -12]);
  if (item.gscDataQuality?.completeness != null && item.gscDataQuality.completeness < 0.8) {
    points.push(["GSC completeness below 80%", -8]);
  }
  if (item.gscDataQuality?.freshness === "STALE") points.push(["GSC snapshot is stale", -10]);
  else if (item.gscDataQuality?.freshness === "AGING") points.push(["GSC snapshot is aging", -4]);

  if (item.cannibalization?.severity === "HIGH") points.push(["high cannibalization", -10]);
  else if (item.cannibalization?.severity === "MEDIUM") points.push(["medium cannibalization", -5]);

  if (item.temporalCannibalization?.actionable) {
    points.push([
      item.temporalCannibalization.severity === "HIGH"
        ? "high temporal ownership shift"
        : "medium temporal ownership shift",
      item.temporalCannibalization.severity === "HIGH" ? 4 : 2
    ]);
  }

  if (item.gapDetected) points.push(["content gap confirmed", 4]);

  return points;
}

function decisionConfidenceScore(item = {}) {
  const raw = clamp(
    30 + decisionConfidenceEvidence(item).reduce((sum, [, value]) => sum + value, 0)
  );

  // Evidence strength is explicitly non-probabilistic. Quality failures still
  // need hard ceilings so stale/partial inputs cannot look "high confidence".
  let ceiling = 100;

  if (item.gscDataQuality?.truncated) {
    ceiling = Math.min(ceiling, 78);
  }
  if (item.gscDataQuality?.freshness === "STALE") {
    ceiling = Math.min(ceiling, 72);
  } else if (item.gscDataQuality?.freshness === "AGING") {
    ceiling = Math.min(ceiling, 84);
  }

  const marketFreshness = String(
    item.marketDataQuality?.freshness || item.marketSignal?.dataFreshness || ""
  ).toUpperCase();
  if (item.marketSignal?.available && marketFreshness === "STALE") {
    ceiling = Math.min(ceiling, 82);
  }

  const competitorFreshness = String(
    item.competitorDataQuality?.freshness || item.competitorGap?.dataFreshness || ""
  ).toUpperCase();
  if (item.competitorGap?.available && competitorFreshness === "STALE") {
    ceiling = Math.min(ceiling, 82);
  }

  if (item.semanticQueryCluster?.ownerDominanceEvidence === "WEAK") {
    ceiling = Math.min(ceiling, 76);
  }
  if (item.searchOwnership?.ownerDominanceEvidence === "WEAK") {
    ceiling = Math.min(ceiling, 76);
  }

  const intentEvidence = item.searchSignal?.queryIntentEvidence;
  if (
    intentEvidence?.primary &&
    item.searchIntent &&
    intentEvidence.primary !== item.searchIntent &&
    Number(intentEvidence.confidence || 0) >= 0.70
  ) {
    ceiling = Math.min(ceiling, 78);
  }

  const independentSourceCount = evidenceIndependentSourceCount(item);
  if (independentSourceCount === 0) {
    ceiling = Math.min(ceiling, 68);
  }

  return Math.round(clamp(Math.min(raw, ceiling)));
}

function evidenceIndependentSourceCount(item = {}) {
  let count = 0;
  if (
    item.searchSignal?.available ||
    item.searchOwnership?.matchType === "EXACT" ||
    item.cannibalization?.severity ||
    item.temporalCannibalization?.actionable
  ) count += 1;

  if (item.marketSignal?.available || item.competitorGap?.available) count += 1;

  return count;
}

function crossSourceAgreement(item = {}) {
  const gsc = item.searchSignal;
  const market = item.marketSignal;
  if (!gsc?.available || !market?.available) return 0;

  const marketKeyword = normalizeSemanticText(market.matchedKeyword || "");
  const matchedQueries = (gsc.matchedQueries || []).map((query) => normalizeSemanticText(query));
  if (market.matchType === "EXACT" && marketKeyword && matchedQueries.includes(marketKeyword)) return 1;
  if (market.matchType === "SEMANTIC" && Number(market.semanticSimilarity || 0) >= 0.7) return 1;
  return 0;
}

function evidenceStrength(item = {}) {
  const score = decisionConfidenceScore(item);
  const sourceFamilies = new Set();
  const independentSources = new Set();
  const evidenceSignals = new Set();

  if (
    item.searchSignal?.available ||
    item.searchOwnership?.matchType === "EXACT" ||
    item.cannibalization?.severity ||
    item.temporalCannibalization?.actionable
  ) {
    sourceFamilies.add("GSC");
    independentSources.add("GSC");
  }
  if (item.searchSignal?.available) evidenceSignals.add("GSC_SIGNAL");
  if (item.searchOwnership?.matchType === "EXACT") evidenceSignals.add("GSC_OWNERSHIP");
  if (item.cannibalization?.severity) evidenceSignals.add("CANNIBALIZATION");
  if (item.temporalCannibalization?.actionable) evidenceSignals.add("TEMPORAL_OWNERSHIP");

  const ahrefsEvidence = Boolean(item.marketSignal?.available || item.competitorGap?.available);
  if (item.marketSignal?.available) {
    sourceFamilies.add("MARKET");
    evidenceSignals.add("MARKET_SIGNAL");
  }
  if (item.competitorGap?.available) {
    sourceFamilies.add("COMPETITOR");
    evidenceSignals.add("COMPETITOR_GAP");
  }
  // Market demand and competitor gaps are different evidence dimensions,
  // but both are derived from the same Ahrefs provider. Count the provider
  // once when estimating independent-source diversity.
  if (ahrefsEvidence) independentSources.add("AHREFS");
  if (Number.isFinite(Number(item.intentConfidence)) && Number(item.intentConfidence) > 0) {
    sourceFamilies.add("INTENT");
    evidenceSignals.add("INTENT_CONFIDENCE");
  }
  if (item.gapDetected) {
    sourceFamilies.add("SITE_CONTENT");
    evidenceSignals.add("CONTENT_GAP");
  }

  const quality =
    score >= 85 ? "STRONG" :
    score >= 65 ? "MODERATE" :
    score >= 45 ? "WEAK" :
    "INSUFFICIENT";

  return Object.freeze({
    score,
    quality,
    sourceCount: sourceFamilies.size,
    independentSourceCount: independentSources.size,
    independentSources: Object.freeze([...independentSources]),
    sources: Object.freeze([...sourceFamilies]),
    evidenceSignals: Object.freeze([...evidenceSignals]),
    independentMarketAndGsc: sourceFamilies.has("MARKET") && sourceFamilies.has("GSC")
  });
}

function queryIntentAlignmentPenalty(item = {}) {
  const evidence = item.searchSignal?.queryIntentEvidence;
  if (!evidence?.primary) return 0;

  const targetIntent = String(item.searchIntent || item.intent || "").trim().toLowerCase();
  const primaryIntent = String(evidence.primary || "").trim().toLowerCase();
  const confidence = Number(evidence.confidence) || 0;
  const sampleImpressions = Number(evidence.sampleImpressions ?? item.searchSignal?.impressions) || 0;

  if (!targetIntent || !primaryIntent || targetIntent === primaryIntent || confidence < 0.70 || sampleImpressions < 20) {
    return 0;
  }

  // Strong evidence that the live SERP intent differs from the planned asset
  // should lower priority, not merely confidence. Keep the penalty bounded so
  // a useful opportunity is not erased by a single classifier disagreement.
  return evidence.queryCount >= 2 ? 8 : 6;
}

function competitorGapScore(signal = {}) {
  if (!signal?.available) return 0;
  return clamp(
    Math.min(
      18,
      (Number(signal.gapScore) || 0) * 0.12 +
      Math.min(8, Math.max(0, Number(signal.competitorCount) || 0) * 2)
    )
  );
}

function marketSignalScore(signal = {}, item = {}) {
  if (!signal?.available) return null;

  const volume = Math.max(0, Number(signal.estimatedVolume) || 0);
  const difficulty = Number(signal.difficulty);
  const trafficPotential = Math.max(0, Number(signal.trafficPotential) || 0);

  let score = 0;
  if (volume >= 1000) score += 30;
  else if (volume >= 500) score += 25;
  else if (volume >= 100) score += 20;
  else if (volume >= 20) score += 12;
  else if (volume > 0) score += 5;

  if (Number.isFinite(difficulty)) {
    if (difficulty <= 20) score += 25;
    else if (difficulty <= 40) score += 18;
    else if (difficulty <= 60) score += 10;
    else if (difficulty <= 80) score += 4;
  }

  if (trafficPotential >= 1000) score += 15;
  else if (trafficPotential >= 500) score += 10;
  else if (trafficPotential > 0) score += 5;

  const ageDays = Number(signal.dataAgeDays ?? signal.ageDays);
  const freshness = String(
    signal.dataFreshness ||
    item.marketDataQuality?.freshness ||
    ""
  ).toUpperCase();
  if (freshness === "STALE" || (Number.isFinite(ageDays) && ageDays > 16)) {
    score *= 0.5;
  } else if (freshness === "AGING" || (Number.isFinite(ageDays) && ageDays > 8)) {
    score *= 0.8;
  }

  return clamp(score);
}

function isCtrUnderperforming(signal = {}) {
  const ctr = Math.max(0, Number(signal.ctr) || 0);
  const benchmark = Number(signal.ctrBenchmark);
  const benchmarkSample = Number(signal.ctrBenchmarkImpressions);
  if (Number.isFinite(benchmark) && benchmark > 0 && benchmarkSample >= 50) {
    const ratio = ctr / benchmark;
    return ratio < 0.65;
  }
  return ctr < 0.03;
}

function searchSignalScore(signal = {}) {
  if (!signal?.available) return 0;
  const impressions = Math.max(0, Number(signal.impressions) || 0);
  const position = Number(signal.position);
  const ctr = Math.max(0, Number(signal.ctr) || 0);
  const benchmark = Number(signal.ctrBenchmark);
  const benchmarkSample = Number(signal.ctrBenchmarkImpressions);
  let score = 0;
  if (impressions >= 2000) score += 35;
  else if (impressions >= 1000) score += 30;
  else if (impressions >= 300) score += 22;
  else if (impressions >= 100) score += 14;
  else if (impressions > 0) score += 7;
  if (Number.isFinite(position)) {
    if (position >= 4 && position <= 10) score += 35;
    else if (position > 10 && position <= 20) score += 25;
    else if (position > 20 && position <= 50) score += 10;
  }
  if (Number.isFinite(benchmark) && benchmark > 0 && benchmarkSample >= 50) {
    const ratio = ctr / benchmark;
    if (ratio < 0.45) score += 25;
    else if (ratio < 0.65) score += 18;
    else if (ratio < 0.85) score += 8;
  } else {
    if (ctr < 0.02) score += 25;
    else if (ctr < 0.04) score += 18;
    else if (ctr < 0.06) score += 8;
  }
  return clamp(score);
}

export function classifyOpportunityAction(item = {}) {
  const signal = item.searchSignal || {};
  const competition = item.cannibalization?.severity || item.competition?.severity || "NONE";
  const temporal = item.temporalCannibalization || null;
  const hasExistingTarget = Number(item.articleCount) > 0 || Boolean(item.existingArticleSlugs?.length);
  // When GSC already attributes a matching non-brand query to one dominant
  // URL, reinforce that owner rather than creating a competing article.
  if (
    item.action === "NEW_CONTENT" &&
    item.semanticQueryCluster?.ownerStatus === "STABLE" &&
    Number(item.semanticQueryCluster.impressions || 0) >= 20 &&
    Number(item.semanticQueryCluster.topShare || 0) >= 0.75 &&
    item.semanticQueryCluster.ownerDominanceEvidence !== "WEAK"
  ) {
    return "LINK";
  }

  if (
    item.action === "NEW_CONTENT" &&
    item.searchOwnership?.available &&
    item.searchOwnership?.matchType === "EXACT" &&
    item.searchOwnership.ownerStatus === "STABLE" &&
    Number(item.searchOwnership.impressions || 0) >= 20 &&
    Number(item.searchOwnership.topShare || 0) >= 0.7 &&
    item.searchOwnership.ownerDominanceEvidence !== "WEAK"
  ) {
    return "LINK";
  }

  // Hard conflicts must be resolved before creation. A page with strong
  // simultaneous competition should not bypass the merge decision merely
  // because its upstream candidate action was NEW_CONTENT.
  if (competition === "HIGH") return "MERGE_CONTENT";
  if (temporal?.severity === "HIGH" && temporal.actionable) return "MERGE_CONTENT";

  // Search demand can justify creating a new article, but it cannot turn a
  // non-existent article into an "optimize existing" task when no established
  // owner is present.
  if (item.action === "NEW_CONTENT" && !hasExistingTarget) return "NEW_CONTENT";
  if (temporal?.severity === "MEDIUM" && temporal.actionable && item.internalLinkGap !== true && item.linkGap !== true) return "OPTIMIZE_EXISTING";
  if (item.internalLinkGap === true || item.linkGap === true) return "LINK";

  // Query demand can exist before a dedicated article exists. For a genuinely
  // new content opportunity without an established owner, use that demand as a
  // scoring signal only; do not relabel the action as an optimization/
  // expansion of a page that does not exist.

  if (signal.available) {
    if (signal.position != null && signal.position <= 10 && isCtrUnderperforming(signal)) return "OPTIMIZE_EXISTING";
    if (signal.position != null && signal.position > 10 && signal.position <= 30) return "EXPAND";
    return item.action || "OPTIMIZE_EXISTING";
  }
  return item.action || "NEW_CONTENT";
}

function decisionGuard(item = {}, evidence = {}, rawScore = 0) {
  const reasons = [];
  let cap = 100;

  if (item.gscDataQuality?.truncated) {
    cap = Math.min(cap, 78);
    reasons.push("GSC_PARTIAL_COVERAGE");
  }
  if (item.gscDataQuality?.freshness === "STALE") {
    cap = Math.min(cap, 72);
    reasons.push("GSC_STALE");
  } else if (item.gscDataQuality?.freshness === "AGING") {
    cap = Math.min(cap, 88);
    reasons.push("GSC_AGING");
  }

  if (item.marketDataQuality?.freshness === "STALE") {
    cap = Math.min(cap, 82);
    reasons.push("MARKET_STALE");
  } else if (item.marketDataQuality?.freshness === "AGING") {
    cap = Math.min(cap, 92);
    reasons.push("MARKET_AGING");
  }

  if (item.competitorDataQuality?.freshness === "STALE") {
    cap = Math.min(cap, 86);
    reasons.push("COMPETITOR_STALE");
  } else if (item.competitorDataQuality?.freshness === "AGING") {
    cap = Math.min(cap, 94);
    reasons.push("COMPETITOR_AGING");
  }

  if (evidence.independentSourceCount === 0 && evidence.quality === "INSUFFICIENT") {
    cap = Math.min(cap, 55);
    reasons.push("EVIDENCE_INSUFFICIENT");
  } else if (evidence.independentSourceCount === 0 && evidence.quality === "WEAK") {
    cap = Math.min(cap, 68);
    reasons.push("NO_INDEPENDENT_SOURCE");
  } else if (evidence.independentSourceCount === 1 && evidence.quality === "WEAK") {
    cap = Math.min(cap, 72);
    reasons.push("SINGLE_SOURCE_WEAK");
  }

  return Object.freeze({
    rawScore: clamp(rawScore),
    cappedScore: Math.min(clamp(rawScore), cap),
    cap,
    guarded: cap < 100,
    reasons: Object.freeze(reasons)
  });
}

function buildDecisionTrace(item, action, evidence) {
  const reasonCodes = [];

  if (
    item.searchOwnership?.matchType === "EXACT" &&
    item.searchOwnership?.ownerStatus === "STABLE"
  ) {
    reasonCodes.push("GSC_EXACT_OWNER_STABLE");
  } else if (item.semanticQueryCluster?.ownerStatus === "STABLE") {
    reasonCodes.push("GSC_SEMANTIC_CLUSTER_STABLE");
  }

  if (item.cannibalization?.severity === "HIGH") reasonCodes.push("CANNIBALIZATION_HIGH");
  else if (item.cannibalization?.severity === "MEDIUM") reasonCodes.push("CANNIBALIZATION_MEDIUM");

  if (item.temporalCannibalization?.actionable) {
    const prefix = item.temporalCannibalization.mode === "SEMANTIC_CLUSTER"
      ? "TEMPORAL_SEMANTIC_OWNER_SHIFT_"
      : "TEMPORAL_OWNER_SHIFT_";
    reasonCodes.push(
      prefix + (
        item.temporalCannibalization.severity === "HIGH"
          ? "HIGH"
          : "MEDIUM"
      )
    );
  }

  const position = Number(item.searchSignal?.position);
  const ctr = Number(item.searchSignal?.ctr);
  if (Number.isFinite(position) && position >= 1 && position <= 10 && Number.isFinite(ctr) && isCtrUnderperforming(item.searchSignal)) {
    reasonCodes.push("TOP10_LOW_CTR");
  }
  if (Number.isFinite(position) && position > 10 && position <= 30) {
    reasonCodes.push("STRIKING_DISTANCE");
  }
  if (item.internalLinkGap === true || item.linkGap === true) reasonCodes.push("INTERNAL_LINK_GAP");
  const queryIntent = item.searchSignal?.queryIntentEvidence;
  const targetIntent = String(item.searchIntent || item.intent || "").toLowerCase();
  if (queryIntent?.primary) {
    if (targetIntent && queryIntent.primary === targetIntent && Number(queryIntent.confidence || 0) >= 0.55) {
      reasonCodes.push("GSC_QUERY_INTENT_AGREEMENT");
    } else if (targetIntent && queryIntent.primary !== targetIntent && Number(queryIntent.confidence || 0) >= 0.70) {
      reasonCodes.push("GSC_QUERY_INTENT_CONFLICT");
    } else if (Number(queryIntent.primaryShare || 0) < 0.50 && Number(queryIntent.queryCount || 0) >= 2) {
      reasonCodes.push("GSC_QUERY_INTENT_AMBIGUOUS");
    }
  }

  if (item.gapDetected) reasonCodes.push("CONTENT_GAP");
  if (item.competitorGap?.available) reasonCodes.push("COMPETITOR_GAP_PRESENT");
  if (item.marketSignal?.available) reasonCodes.push("MARKET_SIGNAL_PRESENT");
  if (evidence.independentMarketAndGsc) reasonCodes.push("CROSS_SOURCE_EVIDENCE");

  if (reasonCodes.length === 0) {
    reasonCodes.push(action === "NEW_CONTENT" ? "NO_ESTABLISHED_OWNER" : "UPSTREAM_ACTION");
  }

  return Object.freeze({
    action,
    reasonCodes: Object.freeze([...new Set(reasonCodes)]),
    evidenceScore: evidence.score,
    evidenceQuality: evidence.quality,
    evidenceSources: evidence.sources
  });
}

export function scoreOpportunity(item = {}) {
  const base = clamp(item.priority);
  const signal = searchSignalScore(item.searchSignal);
  const market = marketSignalScore(item.marketSignal, item);
  const competitor = competitorGapScore(item.competitorGap);
  const competitionPenalty = item.cannibalization?.severity === "HIGH" ? 0 : item.cannibalization?.severity === "MEDIUM" ? 3 : 0;
  const queryIntentPenalty = queryIntentAlignmentPenalty(item);
  const temporalBonus = item.temporalCannibalization?.actionable ? (item.temporalCannibalization.severity === "HIGH" ? 10 : 5) : 0;

  const weightedBase = base * 0.55;
  const weightedSearch = signal * 0.45;
  const weightedMarket = market == null ? 0 : market * 0.20;
  const weightedCompetitor = competitor > 0 ? competitor * 0.15 : 0;
  const weightTotal = (market == null ? 1 : 1.2) + (competitor > 0 ? 0.15 : 0);
  const score = clamp(Math.round(
    (weightedBase + weightedSearch + weightedMarket + weightedCompetitor) / weightTotal -
    competitionPenalty -
    queryIntentPenalty +
    temporalBonus
  ));
  const scoredItem = {
    ...item,
    marketSignal: market == null ? undefined : item.marketSignal
  };
  const confidenceEvidence = decisionConfidenceEvidence(scoredItem);
  const decisionConfidence = decisionConfidenceScore(scoredItem);
  const evidence = evidenceStrength(scoredItem);
  const guard = decisionGuard(item, evidence, score);
  const action = classifyOpportunityAction(item);
  const decisionTrace = buildDecisionTrace(item, action, evidence);
  return Object.freeze({
    ...item,
    action,
    priority: Math.round(guard.cappedScore),
    decisionConfidence,
    evidenceStrengthScore: evidence.score,
    scoreBreakdown: Object.freeze({
      basePriority: base,
      searchSignal: signal,
      competitionPenalty,
      queryIntentPenalty,
      temporalBonus,
      marketSignal: market,
      competitorGap: competitor > 0 ? item.competitorGap : null,
      competitorGapScore: competitor,
      decisionConfidence,
      evidenceStrengthScore: evidence.score,
      evidenceStrength: evidence.quality,
      evidenceSourceCount: evidence.sourceCount,
      independentEvidenceSourceCount: evidence.independentSourceCount,
      evidenceSources: evidence.sources,
      independentEvidenceSources: evidence.independentSources,
      evidenceSignals: evidence.evidenceSignals,
      decisionGuard: guard,
      evidenceSources: evidence.sources,
      crossSourceAgreement: crossSourceAgreement(item),
      confidenceEvidence: Object.freeze(confidenceEvidence),
      decisionTrace
    })
  });
}

export function scoreOpportunities(items = []) {
  return items.map(scoreOpportunity).sort((a, b) => b.priority - a.priority || String(a.title || "").localeCompare(String(b.title || ""), "fa"));
}


export { decisionConfidenceScore, decisionConfidenceEvidence, evidenceStrength };
