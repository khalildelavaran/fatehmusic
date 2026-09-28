import { describe, expect, it } from "vitest";
import { buildInternalLinkPlan, buildLinkGraph } from "./internal-links.js";

describe("semantic internal links", () => {
  const pages = [
    {
      url: "https://fatehmusic.ir/blog/guitar-guide",
      title: "راهنمای آموزش گیتار در شوشتر",
      type: "Article",
      topics: ["guitar", "shushtar"],
      priority: 12
    },
    {
      url: "https://fatehmusic.ir/courses/guitar-course",
      title: "کلاس آموزش گیتار",
      type: "Course",
      topics: ["guitar"],
      priority: 10
    },
    {
      url: "https://fatehmusic.ir/courses/piano-course",
      title: "کلاس آموزش پیانو",
      type: "Course",
      topics: ["piano"],
      priority: 10
    }
  ];

  it("uses semantic context even when topic labels are not identical", () => {
    const result = buildInternalLinkPlan({
      currentUrl: pages[0].url,
      currentTopics: pages[0].topics,
      currentType: pages[0].type,
      candidates: pages
    });

    const guitar = result.find((item) => item.url.endsWith("/guitar-course"));
    const piano = result.find((item) => item.url.endsWith("/piano-course"));
    expect(guitar.topicalSimilarity).toBeGreaterThan(piano.topicalSimilarity);
    expect(guitar.score).toBeGreaterThan(piano.score);
  });

  it("surfaces inbound saturation and orphan-target boosts", () => {
    const graph = buildLinkGraph(pages, { limit: 2, maxInboundLinks: 1 });
    for (const page of graph) {
      for (const link of page.links) {
        expect(Number.isFinite(link.finalScore)).toBe(true);
        expect(Number.isInteger(link.inboundLinksBeforePlan)).toBe(true);
      }
    }
  });

  it("enforces the inbound cap globally instead of only reporting saturation", () => {
    const graph = buildLinkGraph(pages, { limit: 2, maxInboundLinks: 1, maxOutboundLinks: 2 });
    const inbound = new Map();

    for (const page of graph) {
      expect(page.links.length).toBeLessThanOrEqual(2);
      for (const link of page.links) {
        const key = link.url.replace(/\/$/, "");
        inbound.set(key, (inbound.get(key) || 0) + 1);
        expect(link.inboundLinksAfterPlan).toBeGreaterThan(0);
      }
    }

    for (const count of inbound.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});
