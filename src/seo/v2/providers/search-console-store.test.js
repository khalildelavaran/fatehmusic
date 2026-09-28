import { describe, expect, it } from "vitest";
import { getRecentSearchConsoleRows, getGscPagePerformance } from "./search-console-store.js";

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


describe("GSC page performance", () => {
  it("does not treat an invalid position as a zero-ranked page", async () => {
    const db = {
      prepare(statement) {
        return {
          bind() {
            return {
              async all() {
                if (statement.includes("gsc_search_signals_v2")) {
                  return {
                    results: [
                      {
                        page: "https://fatehmusic.ir/blog/test",
                        clicks: 10,
                        impressions: 1000,
                        position: "invalid",
                        snapshotLabel: "current"
                      },
                      {
                        page: "https://fatehmusic.ir/blog/test",
                        clicks: 2,
                        impressions: 100,
                        position: 8,
                        snapshotLabel: "current"
                      }
                    ]
                  };
                }
                return { results: [] };
              }
            };
          }
        };
      }
    };

    const [page] = await getGscPagePerformance(db);

    expect(page.position).toBe(8);
  });
});
