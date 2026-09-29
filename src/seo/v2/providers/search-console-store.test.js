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


describe("GSC page URL canonicalization", () => {
  it("removes trailing slashes and fragments from stored page URLs", async () => {
    const db = {
      prepare(statement) {
        return {
          bind() {
            return {
              async all() {
                return {
                  results: [{
                    query: "آموزش گیتار",
                    page: "https://fatehmusic.ir/courses/guitar-course/#section",
                    clicks: 1,
                    impressions: 2,
                    ctr: 0.5,
                    position: 5,
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
    expect(rows[0].page).toBe("https://fatehmusic.ir/courses/guitar-course");
  });

  it("merges slash variants in page performance", async () => {
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
                        page: "https://fatehmusic.ir/courses/guitar-course/",
                        clicks: 2,
                        impressions: 20,
                        position: 6,
                        snapshotLabel: "current"
                      },
                      {
                        page: "https://fatehmusic.ir/courses/guitar-course",
                        clicks: 3,
                        impressions: 10,
                        position: 4,
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

    const [page] = await getGscPagePerformance(db, undefined, { days: 90 });
    expect(page.page).toBe("https://fatehmusic.ir/courses/guitar-course");
    expect(page.clicks).toBe(5);
    expect(page.impressions).toBe(30);
    expect(page.position).toBeCloseTo((20 * 6 + 10 * 4) / 30);
  });
});


describe("GSC effective snapshot freshness", () => {
  it("returns the latest live current-snapshot timestamp, not an empty sync completion time", async () => {
    let sql = "";
    const db = {
      prepare(statement) {
        sql = statement;
        return {
          bind() {
            return {
              async first() {
                return {
                  id: 99,
                  siteUrl: "https://fatehmusic.ir",
                  status: "success",
                  rowsReceived: 0,
                  rowsStored: 0,
                  truncated: 0,
                  finishedAt: "2026-09-29 08:00:00",
                  snapshotSyncedAt: "2026-09-25 08:00:00"
                };
              }
            };
          }
        };
      }
    };

    const run = await (await import("./search-console-store.js")).getLatestGscSyncRun(db);

    expect(sql).toContain("MAX(s.synced_at)");
    expect(run.snapshotSyncedAt).toBe("2026-09-25 08:00:00");
    expect(run.finishedAt).toBe("2026-09-29 08:00:00");
  });
});
