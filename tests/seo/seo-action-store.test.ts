import { describe, expect, it } from "vitest";
import { syncPublishedSeoActionMeasurements } from "../../src/seo/v2/seo-action-store.js";

describe("SEO action GSC measurement", () => {
  it("passes the requested snapshot label to the measurement query", async () => {
    let sql = "";
    let args: unknown[] = [];
    const db = {
      prepare(statement: string) {
        sql = statement;
        return {
          bind(...values: unknown[]) {
            args = values;
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

    expect(sql).toContain("g.snapshot_label = ?");
    expect(args).toContain("previous");
  });
});
