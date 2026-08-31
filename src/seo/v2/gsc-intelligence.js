import { scoreOpportunities } from "./opportunity-scoring.js";
import { buildGscSignalIndex, detectSearchCannibalization, resolveOpportunitySearchSignals } from "./gsc-signal-resolver.js";

/** Enrich the unified content queue with real GSC signals when available. */
export function enrichOpportunitiesWithSearchConsole(opportunities = [], rows = []) {
  const index = buildGscSignalIndex(rows);
  const enriched = resolveOpportunitySearchSignals(opportunities, index);
  const scored = scoreOpportunities(enriched, new Map(enriched.map((item) => [item.url || item.suggestedSlug || `${item.topic}|${item.searchIntent}`, item.searchSignal])));
  return Object.freeze({
    opportunities: Object.freeze(scored),
    signalRowCount: rows.length,
    connected: rows.length > 0,
    cannibalization: Object.freeze(detectSearchCannibalization(rows)),
    summary: Object.freeze({
      connected: rows.length > 0,
      signalRows: rows.length,
      opportunityCount: scored.length,
      searchBackedCount: scored.filter((item) => item.searchSignal?.available).length,
      optimizeExistingCount: scored.filter((item) => item.action === "OPTIMIZE_EXISTING").length,
      newContentCount: scored.filter((item) => item.action === "NEW_CONTENT").length
    })
  });
}
