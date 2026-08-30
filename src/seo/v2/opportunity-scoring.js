/**
 * Unified SEO/GEO opportunity scoring.
 *
 * Search signals are optional. When unavailable, they contribute zero rather
 * than fabricated values. This keeps the engine deterministic and makes a
 * future Google Search Console adapter a drop-in provider.
 */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

const INTENT_VALUE = Object.freeze({
  transactional: 100,
  local: 92,
  commercial: 84,
  informational: 70,
  navigational: 58
});

/**
 * Normalize an optional Search Console-style signal object.
 * Supported fields: impressions, clicks, ctr (0..1 or 0..100), position.
 */
export function normalizeSearchSignals(signal = null) {
  if (!signal || typeof signal !== "object") return Object.freeze({ available: false, impressions: 0, clicks: 0, ctr: 0, position: null });
  const impressions = Math.max(0, Number(signal.impressions) || 0);
  const clicks = Math.max(0, Number(signal.clicks) || 0);
  const rawCtr = Number(signal.ctr);
  const ctr = Number.isFinite(rawCtr) ? clamp(rawCtr <= 1 ? rawCtr * 100 : rawCtr, 0, 100) : (impressions ? (clicks / impressions) * 100 : 0);
  const rawPosition = Number(signal.position);
  return Object.freeze({ available: Boolean(signal.available ?? (impressions || clicks || Number.isFinite(rawPosition))), impressions, clicks, ctr, position: Number.isFinite(rawPosition) && rawPosition > 0 ? rawPosition : null, source: signal.source || "unknown" });
}

function searchDemandScore(signal) {
  if (!signal.available || signal.impressions <= 0) return 0;
  return clamp(Math.log10(signal.impressions + 1) / 4 * 100);
}

function ctrOpportunityScore(signal) {
  if (!signal.available || signal.impressions <= 0) return 0;
  // Low CTR with meaningful impressions represents an actionable opportunity.
  const ctrGap = clamp((6 - signal.ctr) / 6 * 100);
  return signal.position !== null && signal.position <= 20 ? ctrGap : ctrGap * 0.7;
}

function positionOpportunityScore(signal) {
  if (!signal.available || signal.position === null) return 0;
  if (signal.position <= 3) return 35;
  if (signal.position <= 10) return 100;
  if (signal.position <= 20) return 82;
  if (signal.position <= 50) return 55;
  if (signal.position <= 100) return 25;
  return 0;
}

/**
 * Calculate a 0..100 score. Search data is intentionally a minority of the
 * score until enough real GSC history exists; this avoids letting noisy early
 * data overwhelm business and topical authority signals.
 */
export function scoreOpportunity(item = {}, searchSignal = null) {
  const signal = normalizeSearchSignals(searchSignal);
  const intent = item.searchIntent || item.intent || "informational";
  const base = clamp(item.basePriority ?? item.priority ?? 0);
  const business = clamp(item.businessValue ?? (item.course ? 85 : 55));
  const gap = clamp(item.gapPriority ?? (item.gapDetected ? 80 : 35));
  const entity = clamp(item.entityValue ?? (item.targetEntity ? 70 : 40));
  const intentValue = clamp(item.intentValue ?? INTENT_VALUE[intent] ?? 60);
  const coverage = clamp(item.articleCount ? Math.max(0, 100 - item.articleCount * 20) : 100);

  const internalScore = base * 0.22 + business * 0.16 + gap * 0.18 + entity * 0.10 + intentValue * 0.14 + coverage * 0.10;
  const searchScore = signal.available
    ? searchDemandScore(signal) * 0.04 + ctrOpportunityScore(signal) * 0.03 + positionOpportunityScore(signal) * 0.03
    : 0;
  const availabilityAdjustment = signal.available ? 0 : 0;
  const score = clamp(Math.round(internalScore + searchScore + availabilityAdjustment));

  return Object.freeze({
    score,
    source: signal.available ? "internal+search" : "internal",
    breakdown: Object.freeze({ basePriority: base, businessValue: business, contentGap: gap, entityValue: entity, intentValue, coverage, searchDemand: Math.round(searchDemandScore(signal)), ctrOpportunity: Math.round(ctrOpportunityScore(signal)), positionOpportunity: Math.round(positionOpportunityScore(signal)) }),
    searchSignal: signal
  });
}

export function scoreOpportunities(opportunities = [], searchSignals = new Map()) {
  return opportunities.map((item) => {
    const key = item.url || item.suggestedSlug || `${item.topic}|${item.searchIntent}`;
    const scored = scoreOpportunity(item, searchSignals instanceof Map ? searchSignals.get(key) : searchSignals?.[key]);
    return Object.freeze({ ...item, opportunityScore: scored.score, opportunityScoreSource: scored.source, opportunityScoreBreakdown: scored.breakdown, searchSignal: scored.searchSignal });
  }).sort((a, b) => b.opportunityScore - a.opportunityScore || a.title.localeCompare(b.title, "fa"));
}
