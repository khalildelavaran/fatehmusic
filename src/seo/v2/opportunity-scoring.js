/** Unified SEO/GEO opportunity scoring. Deterministic and safe for dashboard use. */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

function decisionConfidenceEvidence(item = {}) {
  const points = [];
  const signal = item.searchSignal;
  const ownership = item.searchOwnership;

  if (signal?.available) {
    points.push(["GSC signal present", 18]);
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
  }

  if (item.marketSignal?.available) {
    points.push(["market signal present", 10]);
    if (Number(item.marketSignal.estimatedVolume) > 0) points.push(["market volume available", 5]);
    if (Number.isFinite(Number(item.marketSignal.difficulty))) points.push(["market difficulty available", 3]);
    if (item.marketSignal.matchType === "EXACT") points.push(["exact market keyword match", 5]);
    else if (item.marketSignal.matchType === "SEMANTIC") points.push(["semantic market keyword match", 2]);
  }

  const intentConfidence = Number(item.intentConfidence);
  if (Number.isFinite(intentConfidence) && intentConfidence > 0) {
    points.push(["intent confidence", Math.round(Math.min(10, intentConfidence * 10))]);
  }

  if (ownership?.matchType === "EXACT") {
    points.push(["exact GSC query ownership", 12]);
    if (ownership.ownerStatus === "STABLE") points.push(["stable query owner", 10]);
    else if (ownership.ownerStatus === "SPLIT") points.push(["split query ownership", -8]);
    else if (ownership.ownerStatus === "EMERGING") points.push(["emerging query ownership", -3]);
  } else if (ownership?.matchType === "RELATED") {
    points.push(["related-only query evidence", 2]);
  }

  if (item.gscDataQuality?.truncated) points.push(["GSC snapshot truncated", -12]);
  if (item.gscDataQuality?.completeness != null && item.gscDataQuality.completeness < 0.8) {
    points.push(["GSC completeness below 80%", -8]);
  }

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
  return Math.round(clamp(
    30 + decisionConfidenceEvidence(item).reduce((sum, [, value]) => sum + value, 0)
  ));
}

export const decisionConfidenceEvidence = decisionConfidenceEvidence;
function marketSignalScore(signal = {}) {
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

  return clamp(score);
}

function searchSignalScore(signal = {}) {
  if (!signal?.available) return 0;
  const impressions = Math.max(0, Number(signal.impressions) || 0);
  const position = Number(signal.position);
  const ctr = Math.max(0, Number(signal.ctr) || 0);
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
  if (ctr < 0.02) score += 25;
  else if (ctr < 0.04) score += 18;
  else if (ctr < 0.06) score += 8;
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
    item.searchOwnership?.available &&
    item.searchOwnership?.matchType === "EXACT" &&
    Number(item.searchOwnership.impressions || 0) >= 5 &&
    Number(item.searchOwnership.topShare || 0) >= 0.7
  ) {
    return "LINK";
  }

  // Search demand can justify creating a new article, but it cannot turn a
  // non-existent article into an "optimize existing" task when no established
  // owner is present.
  if (item.action === "NEW_CONTENT" && !hasExistingTarget) return "NEW_CONTENT";
  if (competition === "HIGH") return "MERGE_CONTENT";
  if (temporal?.severity === "HIGH" && temporal.actionable) return "MERGE_CONTENT";
  if (temporal?.severity === "MEDIUM" && temporal.actionable && item.internalLinkGap !== true && item.linkGap !== true) return "OPTIMIZE_EXISTING";
  if (item.internalLinkGap === true || item.linkGap === true) return "LINK";

  // Query demand can exist before a dedicated article exists. For a genuinely
  // new content opportunity without an established owner, use that demand as a
  // scoring signal only; do not relabel the action as an optimization/
  // expansion of a page that does not exist.
  const hasExistingContent = Number(item.articleCount || 0) > 0 ||
    (Array.isArray(item.existingArticleSlugs) && item.existingArticleSlugs.length > 0);
  if (item.action === "NEW_CONTENT" && !hasExistingContent) return "NEW_CONTENT";

  if (signal.available) {
    if (signal.position != null && signal.position <= 10 && signal.ctr < 0.03) return "OPTIMIZE_EXISTING";
    if (signal.position != null && signal.position > 10 && signal.position <= 30) return "EXPAND";
    return item.action || "OPTIMIZE_EXISTING";
  }
  return item.action || "NEW_CONTENT";
}

export function scoreOpportunity(item = {}) {
  const base = clamp(item.priority);
  const signal = searchSignalScore(item.searchSignal);
  const market = marketSignalScore(item.marketSignal);
  const competitionPenalty = item.cannibalization?.severity === "HIGH" ? 0 : item.cannibalization?.severity === "MEDIUM" ? 3 : 0;
  const temporalBonus = item.temporalCannibalization?.actionable ? (item.temporalCannibalization.severity === "HIGH" ? 10 : 5) : 0;

  const weightedBase = base * 0.55;
  const weightedSearch = signal * 0.45;
  const weightedMarket = market == null ? 0 : market * 0.20;
  const weightTotal = market == null ? 1 : 1.2;
  const score = clamp(Math.round((weightedBase + weightedSearch + weightedMarket) / weightTotal - competitionPenalty + temporalBonus));
  const confidenceEvidence = decisionConfidenceEvidence({
    ...item,
    marketSignal: market == null ? undefined : item.marketSignal
  });
  const decisionConfidence = Math.round(clamp(
    30 + confidenceEvidence.reduce((sum, [, value]) => sum + value, 0)
  ));
  return Object.freeze({
    ...item,
    action: classifyOpportunityAction(item),
    priority: score,
    decisionConfidence,
    scoreBreakdown: Object.freeze({
      basePriority: base,
      searchSignal: signal,
      competitionPenalty,
      temporalBonus,
      marketSignal: market,
      decisionConfidence,
      confidenceEvidence: Object.freeze(confidenceEvidence)
    })
  });
}

export function scoreOpportunities(items = []) {
  return items.map(scoreOpportunity).sort((a, b) => b.priority - a.priority || String(a.title || "").localeCompare(String(b.title || ""), "fa"));
}


export { decisionConfidenceScore, decisionConfidenceEvidence };
