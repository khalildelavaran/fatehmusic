import { describe, expect, it } from "vitest";
import { buildGscSignalIndex, detectSearchCannibalization, resolveOpportunitySearchSignals } from "./gsc-signal-resolver.js";

describe("GSC signal resolver", () => {
  const rows = [
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar", clicks: 20, impressions: 1000, ctr: 0.02, position: 7 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", clicks: 5, impressions: 500, ctr: 0.01, position: 11 }
  ];

  it("aggregates page signals without overwriting rows", () => {
    const index = buildGscSignalIndex(rows);
    expect(index.byPage.get("https://fatehmusic.ir/blog/guitar").impressions).toBe(1000);
    expect(index.byQuery.get("کلاس گیتار شوشتر").impressions).toBe(1500);
  });

  it("resolves a search signal for a matching opportunity", () => {
    const result = resolveOpportunitySearchSignals([
      { title: "کلاس گیتار در شوشتر", topicName: "گیتار", topic: "guitar", searchIntent: "local", suggestedSlug: "guitar-local" }
    ], buildGscSignalIndex(rows));
    expect(result[0].searchSignalSource).toBe("google-search-console");
    expect(result[0].searchSignal.impressions).toBeGreaterThan(0);
  });

  it("detects query cannibalization across pages", () => {
    const conflicts = detectSearchCannibalization(rows);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].pages).toHaveLength(2);
  });
});
