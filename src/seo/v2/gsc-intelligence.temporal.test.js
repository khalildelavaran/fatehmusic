import { describe, expect, it } from "vitest";
import { enrichOpportunitiesWithSearchConsole } from "./gsc-intelligence.js";

describe("GSC temporal signal enrichment", () => {
  it("attaches temporal ownership shifts to affected opportunities", () => {
    const rows = [
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", impressions: 800, startDate: "2026-07-01", endDate: "2026-07-30" },
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 200, startDate: "2026-07-01", endDate: "2026-07-30" },
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", impressions: 250, startDate: "2026-08-01", endDate: "2026-08-30" },
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 750, startDate: "2026-08-01", endDate: "2026-08-30" }
    ];
    const result = enrichOpportunitiesWithSearchConsole([
      { url: "https://fatehmusic.ir/blog/guitar-guide", title: "راهنمای گیتار", priority: 70 }
    ], rows);
    expect(result.temporalCannibalization).toHaveLength(1);
    expect(result.opportunities[0].temporalCannibalization?.severity).toBe("HIGH");
  });
});
