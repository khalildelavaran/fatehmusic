import { describe, expect, it } from "vitest";
import { fetchAllSearchAnalytics } from "./search-console-sync.js";

describe("Search Console sync paging", () => {
  it("maps arbitrary GSC dimensions without losing country/device values", async () => {
    const calls = [];
    const client = {
      configured: true,
      async querySearchAnalytics(options) {
        calls.push(options);
        return { rows: [{
          keys: ["کلاس گیتار", "https://fatehmusic.ir/courses/guitar", "IR", "MOBILE"],
          clicks: 4, impressions: 100, ctr: 0.04, position: 8.2
        }] };
      }
    };

    const result = await fetchAllSearchAnalytics(client, {
      startDate: "2026-08-01", endDate: "2026-08-28",
      dimensions: ["query", "page", "country", "device"],
      pageSize: 100, maxRows: 100
    });

    expect(result.rows[0].country).toBe("IR");
    expect(result.rows[0].device).toBe("MOBILE");
    expect(result.rows[0].query).toBe("کلاس گیتار");
    expect(calls).toHaveLength(1);
  });

  it("reports truncation when the configured cap hides additional GSC rows", async () => {
    const calls = [];
    const client = {
      configured: true,
      async querySearchAnalytics(options) {
        calls.push(options);
        if (options.startRow === 2) {
          return { rows: [{ keys: ["q3", "https://fatehmusic.ir/x"], impressions: 1 }] };
        }
        return {
          rows: [
            { keys: ["q1", "https://fatehmusic.ir/a"], impressions: 1 },
            { keys: ["q2", "https://fatehmusic.ir/b"], impressions: 1 }
          ]
        };
      }
    };

    const result = await fetchAllSearchAnalytics(client, {
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      pageSize: 2,
      maxRows: 2
    });

    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(calls).toHaveLength(2);
  });

});
