import { describe, expect, it } from "vitest";
import { currentScoringRows } from "./gsc-intelligence.js";

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
});
