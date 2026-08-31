import { describe, expect, it } from "vitest";
import { detectTemporalCannibalization } from "./gsc-temporal.js";

describe("temporal cannibalization", () => {
  const rows = [
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 800, clicks: 32 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", startDate: "2026-07-01", endDate: "2026-07-30", impressions: 200, clicks: 8 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 250, clicks: 10 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", startDate: "2026-08-01", endDate: "2026-08-30", impressions: 750, clicks: 30 }
  ];

  it("detects a query-owner transition across dated periods", () => {
    const result = detectTemporalCannibalization(rows);
    expect(result).toHaveLength(1);
    expect(result[0].previousOwner.page).toContain("/courses/guitar");
    expect(result[0].currentOwner.page).toContain("/blog/guitar-guide");
    expect(result[0].severity).toBe("HIGH");
    expect(result[0].actionable).toBe(true);
  });

  it("ignores stable ownership", () => {
    const stable = rows.map((row) => row.page.includes("courses/guitar") ? { ...row, impressions: row.startDate.startsWith("2026-08") ? 700 : 800 } : { ...row, impressions: 300 });
    expect(detectTemporalCannibalization(stable)).toHaveLength(0);
  });

  it("requires dated data", () => {
    expect(detectTemporalCannibalization(rows.map(({ startDate, endDate, ...row }) => row))).toHaveLength(0);
  });
});
