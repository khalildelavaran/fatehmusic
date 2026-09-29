import { describe, expect, it } from "vitest";
import { syncPublishedSeoActionMeasurements } from "../../src/seo/v2/seo-action-store.js";

describe("SEO action GSC measurement", () => {
  it("records a semantic query cohort alongside page totals", async () => {
    let insertArgs: unknown[] = [];
    let insertedSql = "";
    const db = {
      prepare(statement: string) {
        insertedSql = statement;
        if (statement.includes("SELECT a.id AS action_id")) {
          return {
            bind() {
              return {
                all: async () => ({
                  results: [
                    {
                      action_id: 21,
                      target_title: "هزینه کلاس گیتار در شوشتر",
                      query: "قیمت گیتار شوشتر",
                      impressions: 80,
                      clicks: 4,
                      position: 8
                    },
                    {
                      action_id: 21,
                      target_title: "هزینه کلاس گیتار در شوشتر",
                      query: "کلاس پیانو",
                      impressions: 200,
                      clicks: 10,
                      position: 6
                    }
                  ]
                })
              };
            }
          };
        }

        return {
          bind(...values: unknown[]) {
            insertArgs = values;
            return { run: async () => ({ meta: { changes: 1 } }) };
          }
        };
      }
    } as unknown as D1Database;

    await expect(syncPublishedSeoActionMeasurements(db, {
      siteUrl: "https://fatehmusic.ir",
      windowStart: "2026-09-01",
      windowEnd: "2026-09-28"
    })).resolves.toEqual({ measured: 1 });

    expect(insertedSql).toContain("(action_id, measured_at, window_start, window_end, impressions, clicks, ctr, position, source, metadata)");
    expect(insertedSql).toContain("metadata=excluded.metadata");
    const metadata = JSON.parse(String(insertArgs[insertArgs.length - 1]));
    expect(metadata.attributionModel).toBe("PAGE_PLUS_QUERY_COHORT");
    expect(metadata.cohort.impressions).toBe(80);
    expect(metadata.cohort.clicks).toBe(4);
    expect(metadata.cohort.queryCount).toBe(1);
    expect(metadata.cohort.matchedQueries[0].query).toBe("قیمت گیتار شوشتر");
  });

  it("passes the requested snapshot label to the source query", async () => {
    let selectSql = "";
    let selectArgs: unknown[] = [];
    let insertSql = "";
    let insertArgs: unknown[] = [];

    const db = {
      prepare(statement: string) {
        if (statement.includes("SELECT a.id AS action_id")) {
          selectSql = statement;
          return {
            bind(...values: unknown[]) {
              selectArgs = values;
              return {
                all: async () => ({
                  results: [{
                    action_id: 7,
                    query: "آموزش گیتار",
                    impressions: 20,
                    clicks: 2,
                    position: 7
                  }]
                })
              };
            }
          };
        }

        insertSql = statement;
        return {
          bind(...values: unknown[]) {
            insertArgs = values;
            return { run: async () => ({ meta: { changes: 1 } }) };
          }
        };
      }
    } as unknown as D1Database;

    await expect(syncPublishedSeoActionMeasurements(db, {
      siteUrl: "https://fatehmusic.ir",
      windowStart: "2026-09-01",
      windowEnd: "2026-09-28",
      snapshotLabel: "previous"
    })).resolves.toEqual({ measured: 1 });

    expect(selectSql).toContain("g.snapshot_label = ?");
    expect(selectArgs).toContain("previous");
    expect(insertSql).toContain("seo_action_measurements");
    expect(insertArgs).toContain(2);
  });

  it("filters branded queries with the canonical Brand detector before aggregation", async () => {
    let insertArgs: unknown[] = [];
    const db = {
      prepare(statement: string) {
        if (statement.includes("SELECT a.id AS action_id")) {
          return {
            bind() {
              return {
                all: async () => ({
                  results: [
                    {
                      action_id: 9,
                      query: "fateh music academy shushtar",
                      impressions: 1000,
                      clicks: 40,
                      position: 2
                    },
                    {
                      action_id: 9,
                      query: "آموزش گیتار",
                      impressions: 100,
                      clicks: 5,
                      position: 6
                    }
                  ]
                })
              };
            }
          };
        }

        return {
          bind(...values: unknown[]) {
            insertArgs = values;
            return { run: async () => ({ meta: { changes: 1 } }) };
          }
        };
      }
    } as unknown as D1Database;

    await syncPublishedSeoActionMeasurements(db, {
      siteUrl: "https://fatehmusic.ir",
      windowStart: "2026-09-01",
      windowEnd: "2026-09-28"
    });

    // The insert contains actionId, measuredAt, windowStart, windowEnd,
    // impressions, clicks, ctr, position for one row. Brand impressions
    // must not inflate the aggregated 100 non-brand impressions.
    expect(insertArgs).toContain(100);
    expect(insertArgs).toContain(5);
    expect(insertArgs).not.toContain(1100);
  });
  it("returns action outcome data without relying on a global attribution symbol", async () => {
    const db = {
      prepare(statement: string) {
        if (statement.includes("FROM seo_action_log")) {
          return {
            bind() {
              return {
                all: async () => ({
                  results: [{
                    id: 12,
                    actionType: "OPTIMIZE_EXISTING",
                    target_url: "https://fatehmusic.ir/courses/guitar-course",
                    target_slug: "guitar-course",
                    target_title: "آموزش گیتار",
                    status: "published"
                  }]
                })
              };
            }
          };
        }
        return {
          bind() {
            return {
              all: async () => ({ results: [] })
            };
          }
        };
      }
    } as unknown as D1Database;

    const actions = await (await import("../../src/seo/v2/seo-action-store.js")).listSeoActions(db);
    expect(actions).toHaveLength(1);
    expect(actions[0].outcome.effect).toBe("INSUFFICIENT_DATA");
  });
});

