import { describe, expect, it } from "vitest";
import { buildMarketOpportunityReport, buildMarketSignalMap } from "./market-opportunities.js";

describe("Ahrefs market opportunity discovery", () => {
  it("finds striking-distance keywords and joins exact GSC evidence", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [
        {
          keyword: "آموزش گیتار شوشتر",
          volume_monthly: 200,
          keyword_difficulty: 30,
          best_position: 14,
          best_position_url: "https://fatehmusic.ir/courses/guitar-course"
        }
      ],
      gscRows: [
        {
          query: "آموزش گیتار شوشتر",
          impressions: 80,
          clicks: 4,
          position: 14
        }
      ]
    });

    expect(result).toHaveLength(1);
    expect(result[0].classification).toBe("STRIKING_DISTANCE");
    expect(result[0].action).toBe("OPTIMIZE_EXISTING");
    expect(result[0].topic).toBe("guitar");
    expect(result[0].gscSignal.impressions).toBe(80);
  });

  it("does not let brand-navigation queries create market opportunities", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [
        { keyword: "fatehmusic.ir", volume_monthly: 5000, keyword_difficulty: 10, best_position: 1 },
        { keyword: "آموزش تار شوشتر", volume_monthly: 80, keyword_difficulty: 25, best_position: 35 }
      ]
    });

    expect(result.map((item) => item.keyword)).not.toContain("fatehmusic.ir");
    expect(result).toHaveLength(1);
  });
});


describe("market position fallback", () => {
  it("uses GSC position when Ahrefs has no ranking position", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار شوشتر",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: null
      }],
      gscRows: [{
        query: "آموزش گیتار شوشتر",
        impressions: 80,
        clicks: 4,
        position: 17
      }]
    });

    expect(result[0].bestPosition).toBe(17);
    expect(result[0].bestPositionSource).toBe("gsc");
    expect(result[0].classification).toBe("STRIKING_DISTANCE");
  });
});


describe("normalized market signals", () => {
  it("creates a core-scoring signal from Ahrefs opportunity data", () => {
    const report = buildMarketOpportunityReport({
      keywordRows: [
        {
          keyword: "آموزش گیتار شوشتر",
          volume_monthly: 200,
          keyword_difficulty: 30,
          best_position: 14
        }
      ]
    });
    const signals = buildMarketSignalMap(report);
    const signal = signals.get("اموزش گیتار شوشتر");
    expect(signal.available).toBe(true);
    expect(signal.estimatedVolume).toBe(200);
    expect(signal.difficulty).toBe(30);
    expect(signal.source).toBe("ahrefs");
  });
});


describe("market ranking source precedence", () => {
  it("prefers a current GSC position over an older Ahrefs position", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار شوشتر",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: 22,
        best_position_url: "https://fatehmusic.ir/courses/guitar-course"
      }],
      gscRows: [{
        query: "آموزش گیتار شوشتر",
        impressions: 80,
        clicks: 4,
        position: 12
      }],
      gscFreshness: "FRESH"
    });

    expect(result[0].bestPosition).toBe(12);
    expect(result[0].bestPositionSource).toBe("gsc");
    expect(result[0].gscBestPosition).toBe(12);
    expect(result[0].ahrefsBestPosition).toBe(22);
  });

  it("falls back to Ahrefs when GSC is stale and both positions exist", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار شوشتر",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: 22
      }],
      gscRows: [{
        query: "آموزش گیتار شوشتر",
        impressions: 80,
        clicks: 4,
        position: 12
      }],
      gscFreshness: "STALE"
    });

    expect(result[0].bestPosition).toBe(22);
    expect(result[0].bestPositionSource).toBe("ahrefs");
  });
});


describe("market data quality hardening", () => {
  it("aggregates duplicate normalized market rows deterministically", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [
        {
          keyword: "آموزش گیتار",
          volume_monthly: 80,
          keyword_difficulty: 35,
          best_position: 20
        },
        {
          keyword: "اموزش گیتار",
          volume_monthly: 120,
          keyword_difficulty: 30,
          best_position: 14
        }
      ]
    });

    expect(result).toHaveLength(1);
    expect(result[0].volume).toBe(120);
    expect(result[0].difficulty).toBe(30);
    expect(result[0].bestPosition).toBe(14);
    expect(result[0].keyword).toBe("اموزش گیتار");
  });

  it("does not let stale GSC impressions masquerade as live first-party evidence", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: 5
      }],
      gscRows: [{
        query: "آموزش گیتار",
        impressions: 100,
        clicks: 2,
        position: 8
      }],
      gscFreshness: "STALE"
    });

    expect(result[0].bestPosition).toBe(5);
    expect(result[0].bestPositionSource).toBe("ahrefs");
    expect(result[0].classification).toBe("MARKET_ONLY");
    expect(result[0].gscSignalUsable).toBe(false);
  });
});


describe("market position sample gating", () => {
  it("does not let trace-level GSC exposure override an Ahrefs position", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: 22
      }],
      gscRows: [{
        query: "آموزش گیتار",
        impressions: 1,
        clicks: 0,
        position: 5
      }],
      gscFreshness: "FRESH"
    });

    expect(result[0].bestPosition).toBe(22);
    expect(result[0].bestPositionSource).toBe("ahrefs");
    expect(result[0].gscBestPosition).toBe(5);
    expect(result[0].gscPositionEvidence).toBe("TRACE");
  });

  it("still uses GSC when it is the only ranking source", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: null
      }],
      gscRows: [{
        query: "آموزش گیتار",
        impressions: 1,
        clicks: 0,
        position: 17
      }],
      gscFreshness: "FRESH"
    });

    expect(result[0].bestPosition).toBe(17);
    expect(result[0].bestPositionSource).toBe("gsc");
    expect(result[0].gscPositionEvidence).toBe("TRACE");
  });
});


describe("market position provenance", () => {
  it("does not expose a trace-only GSC page as the fused best-position URL", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: 22,
        best_position_url: "https://fatehmusic.ir/courses/guitar-course"
      }],
      gscRows: [{
        query: "آموزش گیتار",
        page: "https://fatehmusic.ir/blog/guitar-guide",
        impressions: 1,
        clicks: 0,
        position: 5
      }],
      gscFreshness: "FRESH"
    });

    expect(result[0].bestPosition).toBe(22);
    expect(result[0].bestPositionSource).toBe("ahrefs");
    expect(result[0].bestPositionUrl).toBe("https://fatehmusic.ir/courses/guitar-course");
  });
});


describe("market signal passthrough", () => {
  it("preserves Ahrefs traffic potential for downstream scoring", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [{
        keyword: "آموزش گیتار",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: 22,
        traffic_potential: 900,
        cpc: 1200
      }]
    });

    expect(result[0].trafficPotential).toBe(900);
    expect(result[0].cpc).toBe(1200);

    const signal = buildMarketSignalMap(result).get("اموزش گیتار");
    expect(signal.trafficPotential).toBe(900);
    expect(signal.cpc).toBe(1200);
  });
});


describe("market duplicate robustness", () => {
  it("preserves a valid difficulty when the higher-volume duplicate omits it", () => {
    const result = buildMarketOpportunityReport({
      keywordRows: [
        {
          keyword: "آموزش گیتار",
          volume_monthly: 80,
          keyword_difficulty: 22,
          best_position: 25
        },
        {
          keyword: "اموزش گیتار",
          volume_monthly: 120,
          keyword_difficulty: null,
          best_position: 18
        }
      ]
    });

    expect(result).toHaveLength(1);
    expect(result[0].volume).toBe(120);
    expect(result[0].difficulty).toBe(22);
    expect(result[0].bestPosition).toBe(18);
  });
});
