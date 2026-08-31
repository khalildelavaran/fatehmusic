import { describe, expect, it } from "vitest";
import { classifyOpportunityAction, scoreOpportunity } from "./opportunity-scoring.js";

describe("opportunity scoring", () => {
  it("prioritizes CTR optimization for a strong-ranking page", () => {
    const item = scoreOpportunity({
      title: "کلاس گیتار در شوشتر",
      priority: 90,
      searchSignal: { available: true, impressions: 2000, clicks: 30, ctr: 0.015, position: 6 }
    });
    expect(item.action).toBe("OPTIMIZE_EXISTING");
    expect(item.priority).toBeGreaterThan(50);
  });

  it("uses expand for pages ranking beyond the first page", () => {
    expect(classifyOpportunityAction({ searchSignal: { available: true, impressions: 500, ctr: 0.04, position: 18 } })).toBe("EXPAND");
  });

  it("uses merge for high-confidence search competition", () => {
    expect(classifyOpportunityAction({ searchSignal: { available: true }, cannibalization: { severity: "HIGH" } })).toBe("MERGE_CONTENT");
  });

  it("uses merge for a high-severity actionable temporal ownership shift", () => {
    expect(classifyOpportunityAction({
      priority: 70,
      temporalCannibalization: { severity: "HIGH", actionable: true }
    })).toBe("MERGE_CONTENT");
  });

  it("uses optimization for a medium actionable temporal ownership shift without a link gap", () => {
    expect(classifyOpportunityAction({
      priority: 70,
      temporalCannibalization: { severity: "MEDIUM", actionable: true },
      internalLinkGap: false
    })).toBe("OPTIMIZE_EXISTING");
  });

  it("adds a bounded temporal bonus to the priority score", () => {
    const base = scoreOpportunity({ priority: 70, searchSignal: { available: false } });
    const temporal = scoreOpportunity({
      priority: 70,
      searchSignal: { available: false },
      temporalCannibalization: { severity: "HIGH", actionable: true }
    });
    expect(temporal.priority).toBeGreaterThan(base.priority);
    expect(temporal.scoreBreakdown.temporalBonus).toBe(10);
  });

  it("keeps new-content opportunities when no search signal exists", () => {
    expect(classifyOpportunityAction({ action: "NEW_CONTENT", searchSignal: { available: false } })).toBe("NEW_CONTENT");
  });
});
