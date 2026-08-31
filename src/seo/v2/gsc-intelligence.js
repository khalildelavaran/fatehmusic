import { scoreOpportunities } from "./opportunity-scoring.js";
import { buildGscSignalIndex, detectSearchCannibalization, resolveOpportunitySearchSignals } from "./gsc-signal-resolver.js";

/** Enrich the unified content queue with real GSC signals when available. */
export function enrichOpportunitiesWithSearchConsole(opportunities = [], rows = [], options = {}) {
  const index = buildGscSignalIndex(rows);
  const conflicts = detectSearchCannibalization(rows, options);
  const conflictByPage = new Map();
  for (const conflict of conflicts) {
    for (const page of conflict.pages) {
      conflictByPage.set(page.page, { query: conflict.query, severity: conflict.severity, confidence: conflict.confidence, semanticSimilarity: conflict.semanticSimilarity, semanticEvidence: conflict.semanticEvidence, actionable: conflict.actionable });
    }
  }
  const enriched = resolveOpportunitySearchSignals(opportunities, index).map((item) => {
    const page = String(item.url || item.targetEntity?.url || "").replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
    const cannibalization = conflictByPage.get(page) || null;
    return Object.freeze({ ...item, cannibalization });
  });
  const scored = scoreOpportunities(enriched);
  return Object.freeze({
    opportunities: Object.freeze(scored),
    signalRowCount: rows.length,
    connected: rows.length > 0,
    cannibalization: Object.freeze(conflicts),
    summary: Object.freeze({
      connected: rows.length > 0,
      signalRows: rows.length,
      opportunityCount: scored.length,
      searchBackedCount: scored.filter((item) => item.searchSignal?.available).length,
      optimizeExistingCount: scored.filter((item) => item.action === "OPTIMIZE_EXISTING").length,
      expandCount: scored.filter((item) => item.action === "EXPAND").length,
      mergeCount: scored.filter((item) => item.action === "MERGE_CONTENT").length,
      linkCount: scored.filter((item) => item.action === "LINK").length,
      newContentCount: scored.filter((item) => item.action === "NEW_CONTENT").length
    })
  });
}
