import { describe, expect, it } from "vitest";
import { classifyGscDimensionMix, currentScoringRows } from "./gsc-intelligence.js";

describe("current GSC snapshot selection", () => {
  it("uses the explicit current snapshot when labelled data is present", () => {
    const rows = [
      { snapshotLabel: "previous", query: "آموزش گیتار", impressions: 100 },
      { snapshotLabel: "current", query: "آموزش سنتور", impressions: 80 },
      { snapshotLabel: "breakdowns-current", query: "آموزش ویولن", impressions: 60 }
    ];

    expect(currentScoringRows(rows).map((row) => row.query)).toEqual(["آموزش سنتور"]);
  });

  it("returns no scoring rows when labelled snapshots exist but current is missing", () => {
    const rows = [
      { snapshotLabel: "previous", query: "آموزش گیتار", impressions: 100 },
      { snapshotLabel: "breakdowns-current", query: "آموزش ویولن", impressions: 60 }
    ];

    expect(currentScoringRows(rows)).toEqual([]);
  });

  it("falls back to the latest dated period only for unlabelled imported rows", () => {
    const rows = [
      { query: "آموزش گیتار", startDate: "2026-07-01", endDate: "2026-07-28" },
      { query: "آموزش سنتور", startDate: "2026-08-01", endDate: "2026-08-28" }
    ];

    expect(currentScoringRows(rows).map((row) => row.query)).toEqual(["آموزش سنتور"]);
  });

  it("filters breakdown rows from an unlabelled mixed-dimensional snapshot", () => {
    const rows = [
      {
        query: "آموزش گیتار",
        page: "https://fatehmusic.ir/courses/guitar-course",
        startDate: "2026-08-01",
        endDate: "2026-08-28",
        impressions: 100
      },
      {
        query: "آموزش گیتار",
        page: "https://fatehmusic.ir/courses/guitar-course",
        country: "irn",
        startDate: "2026-08-01",
        endDate: "2026-08-28",
        impressions: 100
      },
      {
        query: "آموزش سنتور",
        page: "https://fatehmusic.ir/courses/santur-course",
        device: "MOBILE",
        startDate: "2026-08-01",
        endDate: "2026-08-28",
        impressions: 80
      }
    ];

    expect(currentScoringRows(rows)).toHaveLength(1);
    expect(currentScoringRows(rows)[0].query).toBe("آموزش گیتار");
    expect(classifyGscDimensionMix(rows)).toEqual({
      canonicalRows: 1,
      breakdownRows: 2,
      totalRows: 3,
      dimensionMode: "MIXED",
      mixed: true
    });
  });

  it("fails closed when an unlabelled snapshot contains only breakdown rows", () => {
    const rows = [
      {
        query: "آموزش گیتار",
        country: "irn",
        startDate: "2026-08-01",
        endDate: "2026-08-28",
        impressions: 100
      }
    ];

    expect(currentScoringRows(rows)).toEqual([]);
    expect(classifyGscDimensionMix(rows).dimensionMode).toBe("BREAKDOWN");
  });
});
