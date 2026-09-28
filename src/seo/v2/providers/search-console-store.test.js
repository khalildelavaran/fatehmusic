import { describe, expect, it } from "vitest";
import { getRecentSearchConsoleRows } from "./search-console-store.js";

describe("Search Console snapshot store", () => {
  it("reads only current and previous canonical snapshots", async () => {
    let sql = "";
    const db = {
      prepare(statement) {
        sql = statement;
        return {
          bind() {
            return {
              async all() {
                return {
                  results: [{
                    query: "آموزش گیتار",
                    page: "https://fatehmusic.ir/courses/guitar-course",
                    clicks: 12,
                    impressions: 300,
                    ctr: 0.04,
                    position: 8,
                    startDate: "2026-08-01",
                    endDate: "2026-08-28",
                    dataState: "final",
                    country: "",
                    device: "",
                    searchAppearance: "",
                    snapshotLabel: "current"
                  }]
                };
              }
            };
          }
        };
      }
    };

    const rows = await getRecentSearchConsoleRows(db);

    expect(sql).toContain("snapshot_label IN ('current', 'previous')");
    expect(rows[0].snapshotLabel).toBe("current");
    expect(rows[0].impressions).toBe(300);
  });
});
