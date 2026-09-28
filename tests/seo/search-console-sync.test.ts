import { describe, expect, it } from "vitest";
import { conflictTargetForTable, fetchAllSearchAnalytics } from "../../src/seo/v2/providers/search-console-sync.js";

describe("Search Console snapshot upsert keys", () => {
  it("uses snapshot_label for staging rows", () => {
    expect(conflictTargetForTable("gsc_search_signals_staging"))
      .toContain("snapshot_label");
  });

  it("keeps live GSC uniqueness independent of snapshot label", () => {
    expect(conflictTargetForTable("gsc_search_signals_v2"))
      .not.toContain("snapshot_label");
  });
});


describe("Search Console ingestion coverage", () => {
  it("flags truncation when the configured row cap hides additional data", async () => {
    const client = {
      configured: true,
      async querySearchAnalytics({ startRow, rowLimit }: { startRow: number; rowLimit: number }) {
        if (startRow === 0) {
          return {
            rows: Array.from({ length: rowLimit }, (_, index) => ({
              keys: [`query-${startRow + index}`, `https://fatehmusic.ir/p-${startRow + index}`],
              clicks: 1,
              impressions: 10,
              ctr: 0.1,
              position: 8
            }))
          };
        }
        return {
          rows: startRow === 2
            ? [{
                keys: ["query-extra", "https://fatehmusic.ir/extra"],
                clicks: 0,
                impressions: 5,
                ctr: 0,
                position: 12
              }]
            : []
        };
      }
    };

    const result = await fetchAllSearchAnalytics(client, {
      startDate: "2026-09-01",
      endDate: "2026-09-28",
      pageSize: 2,
      maxRows: 2
    });

    expect(result.rows).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.pages).toBe(2);
  });
});
