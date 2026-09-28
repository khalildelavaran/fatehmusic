import { describe, expect, it } from "vitest";
import { listSeoActions } from "../../src/seo/v2/seo-action-store.js";

describe("SEO action measurements", () => {
  it("chooses a non-overlapping previous window", async () => {
    const db = {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async all() {
                if (sql.includes("FROM seo_action_log")) {
                  return {
                    results: [{
                      id: 7,
                      actionType: "CONTENT_DRAFT",
                      target_url: "https://fatehmusic.ir/blog/test",
                      target_slug: "test",
                      target_title: "Test",
                      status: "published"
                    }]
                  };
                }
                expect(args).toEqual([7]);
                return {
                  results: [
                    { actionId: 7, windowStart: "2026-09-01", windowEnd: "2026-09-28", impressions: 200, clicks: 10, ctr: 0.05, position: 9 },
                    { actionId: 7, windowStart: "2026-08-20", windowEnd: "2026-09-16", impressions: 190, clicks: 8, ctr: 0.042, position: 10 },
                    { actionId: 7, windowStart: "2026-08-01", windowEnd: "2026-08-28", impressions: 150, clicks: 6, ctr: 0.04, position: 12 }
                  ]
                };
              }
            };
          }
        };
      }
    };

    const [action] = await listSeoActions(db, { limit: 5 });

    expect(action.latest.windowStart).toBe("2026-09-01");
    expect(action.previous.windowStart).toBe("2026-08-01");
    expect(action.previous.windowEnd).toBe("2026-08-28");
    expect(action.ctrDelta).toBeCloseTo(0.01, 6);
    expect(action.positionDelta).toBeCloseTo(-3, 6);
  });
});
