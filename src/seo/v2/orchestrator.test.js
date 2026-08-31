import { describe, expect, it } from "vitest";
import { buildSEOIntelligence } from "./orchestrator.js";

describe("buildSEOIntelligence", () => {
  it("composes existing engines into one view", () => {
    const result = buildSEOIntelligence({
      posts: [{ slug: "guitar-guide", title: "آموزش گیتار در شوشتر", topic: "گیتار", excerpt: "راهنمای گیتار" }],
      courses: [{ slug: "guitar", title: "کلاس گیتار در شوشتر" }],
      topicCandidates: [],
      gscRows: [{ query: "کلاس گیتار در شوشتر", page: "https://fatehmusic.ir/courses/guitar", clicks: 10, impressions: 500, ctr: 0.02, position: 7 }],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.cluster.articleCount).toBe(1);
    expect(result.gsc.connected).toBe(true);
    expect(result.gsc.signalRowCount).toBe(1);
    expect(result.gsc.temporalCannibalization).toEqual([]);
    expect(Array.isArray(result.opportunities)).toBe(true);
  });

  it("exposes temporal ownership changes", () => {
    const result = buildSEOIntelligence({
      posts: [],
      courses: [],
      topicCandidates: [],
      gscRows: [
        { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", clicks: 20, impressions: 800, startDate: "2026-07-01", endDate: "2026-07-30" },
        { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", clicks: 8, impressions: 200, startDate: "2026-07-01", endDate: "2026-07-30" },
        { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/courses/guitar", clicks: 10, impressions: 250, startDate: "2026-08-01", endDate: "2026-08-30" },
        { query: "کلاس گیتار شوشتر", page: "https://fatehmusic.ir/blog/guitar-guide", clicks: 30, impressions: 750, startDate: "2026-08-01", endDate: "2026-08-30" }
      ],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.gsc.temporalCannibalization).toHaveLength(1);
    expect(result.summary.temporalCannibalizationCount).toBe(1);
    expect(result.summary.temporalActionableCount).toBe(1);
  });

  it("fails soft when Search Console is disconnected", () => {
    const result = buildSEOIntelligence({ siteUrl: "https://fatehmusic.ir" });
    expect(result.gsc.connected).toBe(false);
    expect(result.summary.searchBackedCount).toBe(0);
    expect(result.gsc.temporalCannibalization).toEqual([]);
  });
});
