import { scoreOpportunities } from "./opportunity-scoring.js";
import { buildGscSignalIndex, detectSearchCannibalization, resolveOpportunitySearchSignals, normalizeUrl } from "./gsc-signal-resolver.js";
import { detectTemporalCannibalization } from "./gsc-temporal.js";

/** Enrich the unified content queue with real GSC signals when available. */
export function enrichOpportunitiesWithSearchConsole(opportunities = [], rows = [], options = {}) {
  const index = buildGscSignalIndex(rows);
  const conflicts = detectSearchCannibalization(rows, options);
  const temporal = detectTemporalCannibalization(rows, options);
  const conflictByPage = new Map();
  for (const conflict of conflicts) {
    for (const page of conflict.pages) {
      conflictByPage.set(page.page, {
        query: conflict.query,
        severity: conflict.severity,
        confidence: conflict.confidence,
        semanticSimilarity: conflict.semanticSimilarity,
        semanticEvidence: conflict.semanticEvidence,
        actionable: conflict.actionable
      });
    }
  }
  const temporalByPage = new Map();
  for (const transition of temporal) {
    const payload = {
      query: transition.query,
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
    temporalByPage.set(normalizeUrl(transition.previousOwner.page), payload);
    temporalByPage.set(normalizeUrl(transition.currentOwner.page), payload);
  }
  const enriched = resolveOpportunitySearchSignals(opportunities, index).map((item) => {
    const page = normalizeUrl(item.url || item.targetEntity?.url || "");
    return Object.freeze({
      ...item,
      cannibalization: conflictByPage.get(page) || null,
      temporalCannibalization: temporalByPage.get(page) || null
    });
  });
  const scored = scoreOpportunities(enriched);
  return Object.freeze({
    opportunities: Object.freeze(scored),
    signalRowCount: rows.length,
    connected: rows.length > 0,
    cannibalization: Object.freeze(conflicts),
    temporalCannibalization: Object.freeze(temporal),
    summary: Object.freeze({
      connected: rows.length > 0,
      signalRows: rows.length,
      opportunityCount: scored.length,
      searchBackedCount: scored.filter((item) => item.searchSignal?.available).length,
      optimizeExistingCount: scored.filter((item) => item.action === "OPTIMIZE_EXISTING").length,
      expandCount: scored.filter((item) => item.action === "EXPAND").length,
      mergeCount: scored.filter((item) => item.action === "MERGE_CONTENT").length,
      linkCount: scored.filter((item) => item.action === "LINK").length,
      newContentCount: scored.filter((item) => item.action === "NEW_CONTENT").length,
      temporalCannibalizationCount: temporal.length,
      temporalActionableCount: temporal.filter((item) => item.actionable).length
    })
  });
}
