import { describe, expect, it } from "vitest";
import { buildMarketOpportunityReport } from "./market-opportunities.js";

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
