import { describe, expect, it } from "vitest";
import { detectTemporalCannibalization, ownerForRows, periodKey } from "./gsc-temporal.js";

describe("temporal cannibalization", () => {
  const rows = [
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 800, clicks: 32 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 200, clicks: 8 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 250, clicks: 10 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 750, clicks: 30 }
  ];

  it("normalizes a dated window", () => {
    expect(periodKey(rows[0])).toBe("2026-07-01|2026-07-30");
  });

  it("ranks query owners by impression share", () => {
    const owners = ownerForRows(rows.slice(0, 2));
    expect(owners[0].page).toContain("/courses/guitar");
    expect(owners[0].share).toBe(0.8);
  });

  it("detects a query-owner transition across dated periods", () => {
    const result = detectTemporalCannibalization(rows);
    expect(result).toHaveLength(1);
    expect(result[0].previousOwner.page).toContain("/courses/guitar");
    expect(result[0].currentOwner.page).toContain("/blog/guitar-guide");
    expect(result[0].severity).toBe("HIGH");
    expect(result[0].actionable).toBe(true);
    expect(result[0].shareDelta).toBe(0.55);
  });

  it("ignores stable ownership", () => {
    const stable = [
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 800 },
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 200 },
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 700 },
      { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 300 }
    ];
    expect(detectTemporalCannibalization(stable)).toHaveLength(0);
  });

  it("requires dated data", () => {
    expect(detectTemporalCannibalization(rows.map(({ startDate, endDate, ...row }) => row))).toHaveLength(0);
  });

  it("ignores brand navigation and one-word queries", () => {
    const noisy = [
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/a", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 800 },
      { query: "گیتار", page: "https://fatehmusic.ir/a", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 800 },
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/b", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 700 },
      { query: "گیتار", page: "https://fatehmusic.ir/b", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 700 }
    ];
    expect(detectTemporalCannibalization(noisy)).toHaveLength(0);
  });


  it("detects semantic ownership shifts across equivalent query variants", () => {
    const transitions = detectSemanticTemporalCannibalization([
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 90, startDate: "2026-07-01", endDate: "2026-07-28" },
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 90, startDate: "2026-07-01", endDate: "2026-07-28" },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 30, startDate: "2026-07-01", endDate: "2026-07-28" },
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 30, startDate: "2026-07-01", endDate: "2026-07-28" },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 30, startDate: "2026-08-01", endDate: "2026-08-28" },
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 30, startDate: "2026-08-01", endDate: "2026-08-28" },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 90, startDate: "2026-08-01", endDate: "2026-08-28" },
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 90, startDate: "2026-08-01", endDate: "2026-08-28" }
    ]);

    expect(transitions).toHaveLength(1);
    expect(transitions[0].mode).toBe("SEMANTIC_CLUSTER");
    expect(transitions[0].shareDelta).toBeGreaterThanOrEqual(0.2);
    expect(transitions[0].actionable).toBe(true);
  });

});
