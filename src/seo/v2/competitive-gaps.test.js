import { describe, expect, it } from "vitest";
import {
  buildCompetitiveGapReport,
  buildCompetitiveGapSignalMap
} from "./competitive-gaps.js";

describe("competitive keyword gaps", () => {
  it("keeps only competitor keywords missing from the target set", () => {
    const gaps = buildCompetitiveGapReport({
      competitorKeywordRows: [
        {
          keyword: "کلاس گیتار در شوشتر",
          competitor_domain: "a.example",
          volume_monthly: 120,
          keyword_difficulty: 25
        },
        {
          keyword: "کلاس گیتار در شوشتر",
          competitor_domain: "b.example",
          volume_monthly: 100,
          keyword_difficulty: 30
        },
        {
          keyword: "آموزش گیتار",
          competitor_domain: "a.example",
          volume_monthly: 500,
          keyword_difficulty: 20
        },
        {
          keyword: "آموزشگاه موسیقی فاتح",
          competitor_domain: "a.example",
          volume_monthly: 1000,
          keyword_difficulty: 15
        }
      ],
      targetKeywordRows: [{ keyword: "آموزش گیتار" }],
      targetQueries: ["آموزشگاه موسیقی فاتح"]
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].keyword).toBe("کلاس گیتار در شوشتر");
    expect(gaps[0].competitorCount).toBe(2);
    expect(gaps[0].estimatedVolume).toBe(120);
    expect(gaps[0].gapScore).toBeGreaterThan(0);
  });

  it("keeps local scope distinct from a broader national keyword", () => {
    const gaps = buildCompetitiveGapReport({
      competitorKeywordRows: [
        {
          keyword: "کلاس گیتار در شوشتر",
          competitor_domain: "a.example",
          volume_monthly: 120,
          keyword_difficulty: 25
        }
      ],
      targetQueries: ["آموزش گیتار"],
      semanticMatchThreshold: 0.9
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].keyword).toBe("کلاس گیتار در شوشتر");
    expect(gaps[0].coverageMode).toBe("UNMATCHED_TARGET_SEMANTICALLY");
  });

  it("suppresses equivalent wording variants of an existing target", () => {
    const gaps = buildCompetitiveGapReport({
      competitorKeywordRows: [
        {
          keyword: "کلاس گیتار",
          competitor_domain: "a.example",
          volume_monthly: 120,
          keyword_difficulty: 25
        }
      ],
      targetQueries: ["آموزش گیتار"],
      semanticMatchThreshold: 0.9
    });

    expect(gaps).toHaveLength(0);
  });

  it("builds a normalized signal map without fabricating keyword demand", () => {
    const map = buildCompetitiveGapSignalMap([
      {
        keyword: "کلاس گیتار",
        estimatedVolume: 80,
        difficulty: 30,
        competitorCount: 2,
        gapScore: 60
      }
    ]);

    const signal = map.get("کلاس گیتار");
    expect(signal.available).toBe(true);
    expect(signal.estimatedVolume).toBe(80);
    expect(signal.competitorCount).toBe(2);
    expect(signal.source).toBe("competitor-gap");
  });
});


describe("competitive gap keyword normalization", () => {
  it("keeps the highest-volume raw spelling for a normalized competitor keyword", () => {
    const result = buildCompetitiveGapReport({
      competitorKeywordRows: [
        {
          keyword: "آموزش گیتار شوشتر",
          volume_monthly: 20,
          keyword_difficulty: 30,
          competitor_domain: "competitor-a.example"
        },
        {
          keyword: "اموزش گیتار شوشتر",
          volume_monthly: 80,
          keyword_difficulty: 35,
          competitor_domain: "competitor-a.example"
        }
      ],
      targetKeywordRows: []
    });

    expect(result[0].keyword).toBe("اموزش گیتار شوشتر");
    expect(result[0].estimatedVolume).toBe(80);
  });
});


describe("competitive semantic modifier equivalence", () => {
  it("suppresses pricing synonyms of an existing target", () => {
    const gaps = buildCompetitiveGapReport({
      competitorKeywordRows: [{
        keyword: "هزینه کلاس گیتار",
        competitor_domain: "a.example",
        volume_monthly: 120,
        keyword_difficulty: 25
      }],
      targetQueries: ["قیمت گیتار"],
      semanticMatchThreshold: 0.9
    });

    expect(gaps).toHaveLength(0);
  });
});
