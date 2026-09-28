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
});
