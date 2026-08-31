import { describe, expect, it } from "vitest";
import { buildSEOIntelligence } from "./orchestrator.js";

describe("SEO/GEO orchestrator", () => {
  it("composes existing content, search, link and scoring engines", () => {
    const result = buildSEOIntelligence({
      posts: [
        { slug: "guitar", title: "آموزش گیتار در شوشتر", topic: "گیتار", excerpt: "راهنمای آموزش گیتار" }
      ],
      courses: [
        { slug: "guitar", title: "کلاس گیتار در شوشتر", active: true }
      ],
      topicCandidates: [],
      gscRows: [
        { query: "کلاس گیتار در شوشتر", page: "https://fatehmusic.ir/courses/guitar", clicks: 20, impressions: 1000, ctr: 0.02, position: 7 }
      ],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.cluster.articleCount).toBe(1);
    expect(result.gsc.signalRowCount).toBe(1);
    expect(result.opportunities).toBeInstanceOf(Array);
    expect(result.summary).toHaveProperty("opportunityCount");
  });

  it("keeps the existing engine safe when GSC is disconnected", () => {
    const result = buildSEOIntelligence({ posts: [], courses: [], topicCandidates: [], gscRows: [], siteUrl: "https://fatehmusic.ir" });
    expect(result.gsc.connected).toBe(false);
    expect(result.summary.searchBackedCount).toBe(0);
  });
});
