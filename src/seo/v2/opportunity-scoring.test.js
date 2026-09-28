import { describe, expect, it } from "vitest";
import { classifyOpportunityAction, scoreOpportunity, decisionConfidenceScore, evidenceStrength } from "./opportunity-scoring.js";

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

  it("redirects a new-content opportunity to link reinforcement when GSC already has a dominant owner", () => {
    expect(classifyOpportunityAction({
      action: "NEW_CONTENT",
      searchSignal: { available: false },
      searchOwnership: {
        available: true,
        matchType: "EXACT",
        impressions: 120,
        topPage: "https://fatehmusic.ir/courses/guitar-course",
        topShare: 100 / 120
      }
    })).toBe("LINK");
  });

  it("keeps new-content opportunities when no search signal exists", () => {
    expect(classifyOpportunityAction({ action: "NEW_CONTENT", searchSignal: { available: false } })).toBe("NEW_CONTENT");
  });

  it("does not let a high-cannibalization new-content candidate bypass the merge action", () => {
    expect(classifyOpportunityAction({
      action: "NEW_CONTENT",
      searchSignal: { available: false },
      cannibalization: { severity: "HIGH" }
    })).toBe("MERGE_CONTENT");
  });

  it("exposes evidence strength separately from priority", () => {
    const evidence = evidenceStrength({
      searchSignal: { available: true, impressions: 300, position: 6, matchedQueries: ["آموزش گیتار"] },
      searchOwnership: { matchType: "EXACT", ownerStatus: "STABLE" },
      marketSignal: { available: true, estimatedVolume: 500, difficulty: 20 },
      intentConfidence: 0.9
    });

    expect(evidence.quality).toBe("STRONG");
    expect(evidence.sourceCount).toBeGreaterThanOrEqual(3);
    expect(evidence.independentMarketAndGsc).toBe(true);
  });


  it("does not convert a new article into optimization because a related page has demand", () => {
    expect(classifyOpportunityAction({
      action: "NEW_CONTENT",
      targetEntity: { type: "Course", url: "https://fatehmusic.ir/courses/guitar-course" },
      searchSignal: { available: true, impressions: 5000, ctr: 0.02, position: 6 }
    })).toBe("NEW_CONTENT");
  });

  it("uses market demand and difficulty when Ahrefs data is available", () => {
    const withoutMarket = scoreOpportunity({
      title: "آموزش گیتار",
      priority: 80,
      searchSignal: { available: true, impressions: 100, ctr: 0.04, position: 9 }
    });
    const withMarket = scoreOpportunity({
      title: "آموزش گیتار",
      priority: 80,
      searchSignal: { available: true, impressions: 100, ctr: 0.04, position: 9 },
      marketSignal: { available: true, estimatedVolume: 500, difficulty: 20 }
    });

    expect(withMarket.priority).toBeGreaterThan(withoutMarket.priority);
    expect(withMarket.scoreBreakdown.marketSignal).toBeGreaterThan(0);
    expect(withMarket.decisionConfidence).toBeGreaterThan(withoutMarket.decisionConfidence);
  });

  it("raises decision confidence when exact ownership is stable and well-supported", () => {
    const confidence = decisionConfidenceScore({
      searchSignal: {
        available: true,
        impressions: 300,
        position: 6,
        matchedQueries: ["آموزش گیتار"]
      },
      searchOwnership: {
        matchType: "EXACT",
        ownerStatus: "STABLE"
      }
    });

    expect(confidence).toBeGreaterThanOrEqual(90);
  });

  it("does not overstate confidence for trace-level related evidence", () => {
    const confidence = decisionConfidenceScore({
      searchSignal: {
        available: true,
        impressions: 1,
        position: 20,
        matchedQueries: ["کلاس گیتار"]
      },
      searchOwnership: {
        matchType: "RELATED",
        ownerStatus: "EMERGING"
      }
    });

    expect(confidence).toBeLessThan(75);
  });

  it("uses a stable semantic query cluster to avoid creating a duplicate article", () => {
    expect(classifyOpportunityAction({
      action: "NEW_CONTENT",
      semanticQueryCluster: {
        ownerStatus: "STABLE",
        impressions: 120,
        topShare: 0.82,
        queryCount: 3
      },
      searchSignal: { available: false }
    })).toBe("LINK");
  });

  it("records agreement when GSC and market identify the same exact keyword", () => {
    const result = scoreOpportunity({
      title: "آموزش گیتار",
      priority: 80,
      searchSignal: {
        available: true,
        impressions: 150,
        position: 7,
        ctr: 0.03,
        matchedQueries: ["آموزش گیتار"]
      },
      marketSignal: {
        available: true,
        estimatedVolume: 250,
        difficulty: 30,
        matchType: "EXACT",
        matchedKeyword: "اموزش گیتار"
      }
    });

    expect(result.scoreBreakdown.crossSourceAgreement).toBe(1);
    expect(result.decisionConfidence).toBeGreaterThan(80);
  });

});

  it("does not force link action from related-only ownership", () => {
    expect(classifyOpportunityAction({
      action: "NEW_CONTENT",
      searchSignal: { available: false },
      searchOwnership: {
        available: true,
        matchType: "RELATED",
        impressions: 120,
        topPage: "https://fatehmusic.ir/courses/guitar-course",
        topShare: 0.95
      }
    })).toBe("NEW_CONTENT");
  });
