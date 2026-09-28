import { describe, expect, it } from "vitest";
import { buildGscSignalIndex, buildQueryOwnershipMap, detectSearchCannibalization, resolveOpportunitySearchSignals, isBrandNavigationQuery, normalizeText } from "./gsc-signal-resolver.js";

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

  it("prefers relevant query evidence over unrelated non-brand page aggregate", () => {
    const result = resolveOpportunitySearchSignals([
      {
        action: "OPTIMIZE_EXISTING",
        title: "آموزش گیتار",
        topicName: "گیتار",
        topic: "guitar",
        targetEntity: { url: "https://fatehmusic.ir/courses/guitar-course" }
      }
    ], buildGscSignalIndex([
      { query: "کلاس پیانو", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 0, impressions: 1000, ctr: 0, position: 5 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 2, impressions: 20, ctr: 0.1, position: 5 }
    ]));

    expect(result[0].searchSignal.impressions).toBe(20);
    expect(result[0].searchSignal.matchedQueries).toEqual(["آموزش گیتار"]);
    expect(result[0].searchSignal.matchedPages).toEqual(["https://fatehmusic.ir/courses/guitar-course"]);
  });

  it("resolves a search signal for a matching opportunity", () => {
    const result = resolveOpportunitySearchSignals([
      { title: "کلاس گیتار در شوشتر", topicName: "گیتار", topic: "guitar", searchIntent: "local", suggestedSlug: "guitar-local" }
    ], buildGscSignalIndex(rows));
    expect(result[0].searchSignalSource).toBe("google-search-console");
    expect(result[0].searchSignal.impressions).toBe(1500);
  });

  it("does not turn an invalid position into an optimization signal", () => {
    const index = buildGscSignalIndex([
      {
        query: "آموزش گیتار",
        page: "https://fatehmusic.ir/blog/guitar",
        clicks: 5,
        impressions: 500,
        ctr: 0.01,
        position: "not-a-number"
      }
    ]);

    const result = resolveOpportunitySearchSignals([
      {
        action: "OPTIMIZE_EXISTING",
        title: "آموزش گیتار",
        topicName: "گیتار",
        topic: "guitar",
        targetEntity: { url: "https://fatehmusic.ir/blog/guitar" }
      }
    ], index);

    expect(result[0].searchSignal.position).toBeNull();
    expect(result[0].searchAction).toBe("MONITOR");
  });


  it("returns matched query evidence with the non-brand search signal", () => {
    const result = resolveOpportunitySearchSignals([
      {
        action: "OPTIMIZE_EXISTING",
        title: "آموزش گیتار",
        topicName: "گیتار",
        targetEntity: { url: "https://fatehmusic.ir/courses/guitar-course" }
      }
    ], buildGscSignalIndex([
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 0, impressions: 1000, ctr: 0, position: 4 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 2, impressions: 20, ctr: 0.1, position: 5 },
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 1, impressions: 10, ctr: 0.1, position: 6 }
    ]));
    expect(result[0].searchSignal.matchedQueries).toEqual(
      expect.arrayContaining(["آموزش گیتار", "کلاس گیتار"])
    );
    expect(result[0].searchSignal.matchedQueries).not.toContain("fatehmusic.ir");
  });

  it("does not use a course page signal for a brand-new article opportunity", () => {
    const result = resolveOpportunitySearchSignals([
      {
        action: "LINK",
        title: "آموزش گیتار در شوشتر",
        topicName: "گیتار",
        topic: "guitar",
        targetEntity: { url: "https://fatehmusic.ir/courses/guitar-course" }
      }
    ], buildGscSignalIndex([
      {
        query: "آموزش گیتار",
        page: "https://fatehmusic.ir/courses/guitar-course",
        clicks: 20,
        impressions: 5000,
        ctr: 0.04,
        position: 5
      }
    ]));

    expect(result[0].searchSignalSource).toBe("none");
    expect(result[0].searchSignal.available).toBe(false);
  });

  it("does not let generic queries create demand signals for a specific opportunity", () => {
    const index = buildGscSignalIndex([
      { query: "آموزش", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 200, impressions: 10000, ctr: 0.02, position: 4 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 20, impressions: 300, ctr: 0.067, position: 8 }
    ]);

    const result = resolveOpportunitySearchSignals([
      { title: "آموزش گیتار در شوشتر", topicName: "گیتار", topic: "guitar", action: "NEW_CONTENT" }
    ], index);

    expect(result[0].searchSignal.available).toBe(true);
    expect(result[0].searchSignal.impressions).toBe(300);
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


  it("excludes brand-navigation rows from query reporting signals", () => {
    const index = buildGscSignalIndex([
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/about", clicks: 0, impressions: 1000, ctr: 0, position: 4 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 2, impressions: 20, ctr: 0.1, position: 5 }
    ]);
    expect(index.byQuery.has("fatehmusic.ir")).toBe(true);
    expect(index.byQueryNonBrand.has("fatehmusic.ir")).toBe(false);
    expect(index.byQueryNonBrand.get("آموزش گیتار").impressions).toBe(20);
  });

  it("excludes brand-navigation rows from page-level scoring signals", () => {
    const index = buildGscSignalIndex([
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/about", clicks: 0, impressions: 1000, ctr: 0, position: 4 },
      { query: "درباره آموزشگاه", page: "https://fatehmusic.ir/about", clicks: 2, impressions: 20, ctr: 0.1, position: 5 }
    ]);
    expect(index.byPage.get("https://fatehmusic.ir/about").impressions).toBe(1020);
    expect(index.byPageNonBrand.get("https://fatehmusic.ir/about").impressions).toBe(20);

    const result = resolveOpportunitySearchSignals([
      {
        action: "OPTIMIZE_EXISTING",
        title: "درباره آموزشگاه موسیقی",
        topicName: "آموزشگاه",
        targetEntity: { url: "https://fatehmusic.ir/about" }
      }
    ], index);

    expect(result[0].searchSignal.impressions).toBe(20);
    expect(result[0].searchSignal.ctr).toBe(0.1);
  });

  it("promotes the established GSC owner to the first recommended link", () => {
    const index = buildGscSignalIndex([
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 4, impressions: 100, ctr: 0.04, position: 6 }
    ]);
    const result = resolveOpportunitySearchSignals([
      {
        action: "NEW_CONTENT",
        title: "آموزش گیتار در شوشتر",
        topicName: "گیتار",
        topic: "guitar",
        recommendedLinks: [
          "https://fatehmusic.ir/locations/shushtar",
          "https://fatehmusic.ir/register"
        ]
      }
    ], index);
    expect(result[0].recommendedLinks[0]).toBe("https://fatehmusic.ir/courses/guitar-course");
    expect(result[0].recommendedLinks).toHaveLength(3);
  });

  it("maps an existing non-brand query owner for a new-content opportunity", () => {
    const index = buildGscSignalIndex([
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 4, impressions: 100, ctr: 0.04, position: 6 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/blog/old-guitar", clicks: 1, impressions: 20, ctr: 0.05, position: 12 }
    ]);
    const result = resolveOpportunitySearchSignals([
      {
        action: "NEW_CONTENT",
        title: "آموزش گیتار در شوشتر",
        topicName: "گیتار",
        topic: "guitar"
      }
    ], index);

    expect(result[0].searchSignal.available).toBe(true);
    expect(result[0].searchOwnership.available).toBe(true);
    expect(result[0].searchOwnership.matchType).toBe("EXACT");
    expect(result[0].searchOwnership.topPage).toBe("https://fatehmusic.ir/courses/guitar-course");
    expect(result[0].searchOwnership.topShare).toBeCloseTo(100 / 120);
    expect(result[0].searchOwnership.matchedQueries).toEqual(["آموزش گیتار"]);
  });

  it("keeps brand navigation out of topic demand matching", () => {
    expect(isBrandNavigationQuery("fatehmusic.ir")).toBe(true);
    const index = buildGscSignalIndex([
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/about", clicks: 0, impressions: 1000, ctr: 0, position: 4 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 1, impressions: 50, ctr: 0.02, position: 8 }
    ]);
    const result = resolveOpportunitySearchSignals([
      { title: "آموزش گیتار در شوشتر", topicName: "گیتار", topic: "guitar" }
    ], index);
    expect(result[0].searchSignal.impressions).toBe(50);
  });
});


  it("does not treat related-only query matches as ownership", () => {
    const index = buildGscSignalIndex([
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 4, impressions: 100, ctr: 0.04, position: 6 }
    ]);
    const result = resolveOpportunitySearchSignals([
      {
        action: "NEW_CONTENT",
        title: "آموزش گیتار در شوشتر",
        topicName: "گیتار",
        topic: "guitar"
      }
    ], index);

    expect(result[0].searchOwnership.available).toBe(false);
    expect(result[0].searchOwnership.matchType).toBe("RELATED");
    expect(result[0].searchOwnership.relatedImpressions).toBe(100);
    expect(result[0].searchOwnership.relatedQueries).toEqual(["کلاس گیتار"]);
  });

  it("uses exact query ownership even when related queries have more impressions", () => {
    const index = buildGscSignalIndex([
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", clicks: 4, impressions: 500, ctr: 0.008, position: 15 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 4, impressions: 100, ctr: 0.04, position: 6 }
    ]);
    const result = resolveOpportunitySearchSignals([
      {
        action: "NEW_CONTENT",
        title: "آموزش گیتار در شوشتر",
        topicName: "گیتار",
        topic: "guitar"
      }
    ], index);

    expect(result[0].searchOwnership.matchType).toBe("EXACT");
    expect(result[0].searchOwnership.impressions).toBe(100);
    expect(result[0].searchOwnership.topPage).toBe("https://fatehmusic.ir/courses/guitar-course");
  });


  it("does not treat a single non-generic word as query ownership", () => {
    const index = buildGscSignalIndex([
      { query: "گیتار", page: "https://fatehmusic.ir/courses/guitar-course", clicks: 4, impressions: 100, ctr: 0.04, position: 6 }
    ]);
    const result = resolveOpportunitySearchSignals([
      {
        action: "NEW_CONTENT",
        title: "آموزش گیتار در شوشتر",
        topicName: "گیتار",
        topic: "guitar"
      }
    ], index);

    expect(result[0].searchOwnership.available).toBe(false);
    expect(result[0].searchOwnership.matchType).toBe("RELATED");
    expect(result[0].searchOwnership.relatedImpressions).toBe(0);
  });


describe("Persian query normalization", () => {
  it("normalizes common Arabic and Persian spelling variants", () => {
    expect(normalizeText("اموزش  كلاس موسیقی")).toBe("اموزش کلاس موسیقی");
    expect(normalizeText("أموزشگاه")).toBe("اموزشگاه");
  });

  it("groups آ/ا query variants into the same ownership key", () => {
    const index = buildGscSignalIndex([
      { query: "آموزش ضرب و تمپو", page: "https://fatehmusic.ir/courses/zarb-tempo-course", clicks: 1, impressions: 5, ctr: 0.2, position: 10 },
      { query: "اموزش ضرب و تمپو", page: "https://fatehmusic.ir/courses/zarb-tempo-course", clicks: 1, impressions: 5, ctr: 0.2, position: 10 }
    ]);

    expect(index.byQuery.get("اموزش ضرب و تمپو").impressions).toBe(10);
  });
});


describe("GSC query ownership map", () => {
  it("keeps meaningful two-word queries such as آموزش گیتار eligible", () => {
    const map = buildQueryOwnershipMap([
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 25 },
      { query: "گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 100 }
    ]);

    expect(map).toHaveLength(1);
    expect(map[0].displayQuery).toBe("آموزش گیتار");
    expect(map[0].impressions).toBe(25);
  });

  it("builds page shares for substantive non-brand queries", () => {
    const map = buildQueryOwnershipMap([
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 80 },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 20 },
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/", impressions: 1000 }
    ]);

    expect(map).toHaveLength(1);
    expect(map[0].query).toBe("اموزش گیتار");
    expect(map[0].displayQuery).toBe("آموزش گیتار");
    expect(map[0].impressions).toBe(100);
    expect(map[0].topPage).toBe("https://fatehmusic.ir/courses/guitar-course");
    expect(map[0].topShare).toBe(0.8);
    expect(map[0].pageCount).toBe(2);
  });

  it("does not create ownership rows from generic or one-word queries", () => {
    const map = buildQueryOwnershipMap([
      { query: "آموزش", page: "https://fatehmusic.ir/", impressions: 100 },
      { query: "گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 100 },
      { query: "کلاس گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 10 }
    ]);

    expect(map).toHaveLength(1);
    expect(map[0].query).toBe("کلاس گیتار");
  });
});
