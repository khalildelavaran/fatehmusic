import { describe, expect, it } from "vitest";
import { currentScoringRows, enrichOpportunitiesWithSearchConsole } from "../../src/seo/v2/gsc-intelligence.js";

describe("GSC snapshot isolation", () => {
  const rows = [
    {
      query: "آموزش گیتار شوشتر",
      page: "https://fatehmusic.ir/blog/guitar-guide",
      impressions: 100,
      clicks: 4,
      ctr: 0.04,
      position: 8,
      startDate: "2026-09-01",
      endDate: "2026-09-28",
      snapshotLabel: "current"
    },
    {
      query: "آموزش گیتار شوشتر",
      page: "https://fatehmusic.ir/blog/old-guitar-guide",
      impressions: 900,
      clicks: 9,
      ctr: 0.01,
      position: 20,
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      snapshotLabel: "previous"
    }
  ];

  it("uses only current rows for decision signals", () => {
    const current = currentScoringRows(rows);
    expect(current).toHaveLength(1);
    expect(current[0].page).toContain("guitar-guide");
  });

  it("keeps previous rows available for temporal analysis without inflating current scoring", () => {
    const result = enrichOpportunitiesWithSearchConsole(
      [{
        title: "آموزش گیتار شوشتر",
        topicName: "گیتار",
        topic: "guitar",
        intent: "informational",
        url: "https://fatehmusic.ir/blog/guitar-guide",
        priority: 60
      }],
      rows
    );

    const opportunity = result.opportunities[0];
    expect(opportunity.searchSignal.impressions).toBe(100);
    expect(opportunity.searchSignal.position).toBe(8);
  });

  it("excludes country/device breakdown snapshots from temporal analysis", () => {
    const input = [
      ...rows,
      {
        ...rows[0],
        impressions: 100,
        clicks: 4,
        snapshotLabel: "breakdowns-current",
        country: "ir",
        device: "MOBILE"
      },
      {
        ...rows[1],
        impressions: 900,
        clicks: 9,
        snapshotLabel: "breakdowns-current",
        country: "ir",
        device: "DESKTOP"
      }
    ];

    const result = enrichOpportunitiesWithSearchConsole([], input);
    expect(result.temporalCannibalization).toHaveLength(1);
    expect(result.temporalCannibalization[0].previousOwner.impressions).toBe(900);
    expect(result.temporalCannibalization[0].currentOwner.impressions).toBe(100);
  });

});


describe("GSC query ownership exposure", () => {
  it("exposes site-wide ownership from current scoring rows", () => {
    const result = enrichOpportunitiesWithSearchConsole([], [
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 80, snapshotLabel: "current" },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 20, snapshotLabel: "current" },
      { query: "fatehmusic.ir", page: "https://fatehmusic.ir/", impressions: 5000, snapshotLabel: "current" }
    ]);

    expect(result.queryOwnership).toHaveLength(1);
    expect(result.queryOwnership[0].topPage).toBe("https://fatehmusic.ir/courses/guitar-course");
    expect(result.queryOwnership[0].topShare).toBe(0.8);
    expect(result.summary.queryOwnershipCount).toBe(1);
  });

  it("matches an Ahrefs keyword semantically when no exact keyword exists", () => {
    const result = enrichOpportunitiesWithSearchConsole([
      {
        title: "آموزش گیتار در شوشتر",
        topicName: "گیتار",
        topic: "guitar",
        action: "NEW_CONTENT",
        priority: 70
      }
    ], [], {
      marketSignals: [
        {
          keyword: "کلاس گیتار شوشتر",
          estimatedVolume: 300,
          difficulty: 35,
          available: true,
          source: "ahrefs"
        }
      ]
    });

    expect(result.opportunities[0].marketSignal?.available).toBe(true);
    expect(result.opportunities[0].marketSignal?.matchType).toBe("SEMANTIC");
    expect(result.opportunities[0].marketSignal?.matchedKeyword).toBe("کلاس گیتار شوشتر");
  });

  it("reduces completeness when the current GSC snapshot is truncated", () => {
    const result = enrichOpportunitiesWithSearchConsole([
      { title: "آموزش گیتار شوشتر", action: "NEW_CONTENT", priority: 70 }
    ], [
      { query: "آموزش گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 10, snapshotLabel: "current" }
    ], {
      gscDataQuality: { truncated: true }
    });

    expect(result.dataQuality.truncated).toBe(true);
    expect(result.dataQuality.completeness).toBe(0.7);
    expect(result.summary.gscCompleteness).toBe(0.7);
    expect(result.opportunities[0].gscDataQuality.completeness).toBe(0.7);
  });

  it("accepts ownership filtering options without affecting search scoring", () => {
    const result = enrichOpportunitiesWithSearchConsole([], [
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/courses/guitar-course", impressions: 2, snapshotLabel: "current" },
      { query: "آموزش گیتار", page: "https://fatehmusic.ir/blog/guitar-guide", impressions: 20, snapshotLabel: "current" }
    ], { minOwnershipImpressions: 10, maxOwnershipQueries: 5 });

    expect(result.queryOwnership[0].impressions).toBe(20);
  });
});
