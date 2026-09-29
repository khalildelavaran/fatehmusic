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

  it("uses real GSC demand as an additional target-selection signal", () => {
    const result = buildInternalLinkPlan({
      currentUrl: pages[0].url,
      currentTitle: pages[0].title,
      currentTopics: pages[0].topics,
      currentType: pages[0].type,
      candidates: [
        pages[0],
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
      ],
      gscSignals: new Map([
        ["https://fatehmusic.ir/courses/piano-course", {
          available: true,
          impressions: 1000,
          clicks: 30,
          ctr: 0.03,
          position: 6
        }]
      ])
    });

    const piano = result.find((item) => item.url.endsWith("/piano-course"));
    expect(piano.reasonCodes).toContain("SEARCH_DEMAND");
    expect(piano.searchDemand.impressions).toBe(1000);
    expect(piano.score).toBeGreaterThan(10);
  });

  it("returns concise anchor hints and explainable link reasons", () => {
    const result = buildInternalLinkPlan({
      currentUrl: pages[0].url,
      currentTitle: pages[0].title,
      currentTopics: pages[0].topics,
      currentType: pages[0].type,
      candidates: pages
    });
    const guitar = result.find((item) => item.url.endsWith("/guitar-course"));

    expect(guitar.reasonCodes).toEqual(expect.arrayContaining(["SHARED_TOPIC", "SEMANTIC_SIMILARITY"]));
    expect(guitar.anchorHints.length).toBeGreaterThan(0);
    expect(guitar.anchorHints.length).toBeLessThanOrEqual(4);
    expect(new Set(guitar.anchorHints).size).toBe(guitar.anchorHints.length);
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

  it("keeps semantic targets discoverable without scanning every page in large graphs", () => {
    const pages = [
      {
        url: "https://fatehmusic.ir/blog/source",
        title: "راهنمای ساز هدف",
        type: "Article",
        topics: ["target-instrument"],
        priority: 12
      },
      ...Array.from({ length: 220 }, (_, index) => ({
        url: "https://fatehmusic.ir/blog/noise-" + index,
        title: "مقاله عمومی " + index,
        type: "Article",
        topics: ["noise-" + index],
        priority: 5
      })),
      {
        url: "https://fatehmusic.ir/courses/target-course",
        title: "کلاس ساز هدف",
        type: "Course",
        topics: ["target-instrument"],
        priority: 10
      }
    ];

    const graph = buildLinkGraph(pages, { limit: 2, maxInboundLinks: 4 });
    const source = graph.find((page) => page.url.endsWith("/blog/source"));
    expect(source.links.some((link) => link.url.endsWith("/courses/target-course"))).toBe(true);
  });


  it("applies saturation penalty as inbound demand accumulates", () => {
    const sharedTargetPages = [
      {
        url: "https://fatehmusic.ir/blog/source-a",
        title: "آموزش گیتار A",
        type: "Article",
        topics: ["guitar"],
        priority: 20
      },
      {
        url: "https://fatehmusic.ir/blog/source-b",
        title: "آموزش گیتار B",
        type: "Article",
        topics: ["guitar"],
        priority: 19
      },
      {
        url: "https://fatehmusic.ir/courses/guitar-course",
        title: "کلاس آموزش گیتار",
        type: "Course",
        topics: ["guitar"],
        priority: 10
      }
    ];
    const graph = buildLinkGraph(sharedTargetPages, { limit: 1, maxInboundLinks: 2 });
    const targetLinks = graph
      .flatMap((page) => page.links)
      .filter((link) => link.url.endsWith("/courses/guitar-course"));

    expect(targetLinks.length).toBe(2);
    expect(Math.max(...targetLinks.map((link) => link.saturationPenalty))).toBeGreaterThan(0);
  });


  it("boosts the canonical GSC query owner without bypassing semantic relevance", () => {
    const result = buildInternalLinkPlan({
      currentUrl: pages[0].url,
      currentTitle: pages[0].title,
      currentTopics: pages[0].topics,
      currentType: pages[0].type,
      candidates: [
        pages[0],
        pages[1],
        pages[2]
      ],
      gscOwnership: [{
        query: "آموزش گیتار شوشتر",
        topPage: pages[1].url,
        ownerStatus: "STABLE",
        ownerDominanceEvidence: "STRONG",
        impressions: 200,
        topShare: 0.9
      }]
    });

    const guitar = result.find((item) => item.url === pages[1].url);
    expect(guitar.reasonCodes).toContain("GSC_OWNER_STRONG");
    expect(guitar.score).toBeGreaterThan(10);
  });

});