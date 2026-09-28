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

  it("indexes query tokens while preserving the same matching result", () => {
    const index = buildGscSignalIndex([
      ...rows,
      { query: "آموزش پیانو", page: "https://fatehmusic.ir/blog/piano", clicks: 1, impressions: 300, ctr: 0.003, position: 18 }
    ]);
    expect(index.queryTokenRows.get("گیتار")?.length).toBe(2);

    const result = resolveOpportunitySearchSignals([
      { title: "کلاس گیتار در شوشتر", topicName: "گیتار", topic: "guitar", searchIntent: "local", suggestedSlug: "guitar-local" }
    ], index);
    expect(result[0].searchSignalSource).toBe("google-search-console");
    expect(result[0].searchSignal.impressions).toBeGreaterThan(0);
  });

  it("resolves a search signal for a matching opportunity", () => {
    const result = resolveOpportunitySearchSignals([
      { title: "کلاس گیتار در شوشتر", topicName: "گیتار", topic: "guitar", searchIntent: "local", suggestedSlug: "guitar-local" }
    ], buildGscSignalIndex(rows));
    expect(result[0].searchSignalSource).toBe("google-search-console");
    expect(result[0].searchSignal.impressions).toBeGreaterThan(0);
  });

  it("detects a potential conflict when multiple pages share a query", () => {
    const conflicts = detectSearchCannibalization(rows);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].pages).toHaveLength(2);
    expect(conflicts[0].actionable).toBe(true);
  });

  it("does not confuse a page handoff between reporting windows with simultaneous cannibalization", () => {
    const conflicts = detectSearchCannibalization([
      { query: "آموزش گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar", clicks: 20, impressions: 1000, ctr: 0.02, position: 7, startDate: "2026-08-01", endDate: "2026-08-28" },
      { query: "آموزش گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", clicks: 18, impressions: 900, ctr: 0.02, position: 8, startDate: "2026-08-29", endDate: "2026-09-25" }
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("uses semantic evidence before escalating cannibalization", () => {
    const conflicts = detectSearchCannibalization(rows, {
      similarityThreshold: 0.55,
      pageSemantics: [
        { url: "https://fatehmusic.ir/blog/guitar", topics: ["guitar"], intent: "local", entity: "Article" },
        { url: "https://fatehmusic.ir/blog/guitar-guide", topics: ["piano"], intent: "informational", entity: "Article" }
      ]
    });
    expect(conflicts).toHaveLength(0);
  });

  it("retains a high-severity conflict when semantic evidence confirms the same intent/topic", () => {
    const conflicts = detectSearchCannibalization(rows, {
      similarityThreshold: 0.55,
      pageSemantics: [
        { url: "https://fatehmusic.ir/blog/guitar", topics: ["guitar"], intent: "local", entity: "Article" },
        { url: "https://fatehmusic.ir/blog/guitar-guide", topics: ["guitar"], intent: "local", entity: "Article" }
      ]
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("HIGH");
    expect(conflicts[0].semanticEvidence).toBe(true);
    expect(conflicts[0].semanticSimilarity).toBeGreaterThanOrEqual(0.55);
  });
});
