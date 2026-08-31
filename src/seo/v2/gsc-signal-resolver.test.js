import { describe, expect, it } from "vitest";
import { aggregate, buildGscSignalIndex, detectSearchCannibalization, resolveOpportunitySearchSignals } from "./gsc-signal-resolver.js";

describe("GSC signal resolver", () => {
  const rows = [
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar", clicks: 20, impressions: 1000, ctr: 0.02, position: 7 },
    { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", clicks: 5, impressions: 500, ctr: 0.01, position: 11 }
  ];

  it("aggregates weighted position and CTR from raw rows", () => {
    const result = aggregate(rows);
    expect(result.impressions).toBe(1500);
    expect(result.clicks).toBe(25);
    expect(result.ctr).toBeCloseTo(25 / 1500);
    expect(result.position).toBeCloseTo((1000 * 7 + 500 * 11) / 1500);
  });

  it("aggregates page and query signals without overwriting rows", () => {
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

  it("distinguishes semantic competition from raw query overlap", () => {
    const conflicts = detectSearchCannibalization(rows);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].pages).toHaveLength(2);
    expect(conflicts[0].score).toBeGreaterThanOrEqual(40);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(conflicts[0].severity);
    expect(conflicts[0].recommendedAction).toBeDefined();
  });

  it("never classifies a query overlap as HIGH without semantic agreement", () => {
    const conflicts = detectSearchCannibalization([
      { query: "آموزشگاه موسیقی", page: "https://fatehmusic.ir/courses/guitar", clicks: 10, impressions: 200, position: 8 },
      { query: "آموزشگاه موسیقی", page: "https://fatehmusic.ir/about", clicks: 8, impressions: 180, position: 9 }
    ]);
    expect(conflicts[0].severity).not.toBe("HIGH");
  });
});
