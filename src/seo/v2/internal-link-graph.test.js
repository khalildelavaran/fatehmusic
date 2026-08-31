import { describe, expect, it } from "vitest";
import { buildAutonomousLinkGraph, buildLinkOpportunities } from "./internal-link-graph.js";

describe("autonomous internal link graph", () => {
  const pages = [
    { url: "/blog/guitar-guide", title: "راهنمای گیتار", type: "Article", topics: ["guitar", "music"], entity: "guitar", local: true },
    { url: "/courses/guitar", title: "دوره آموزش گیتار", type: "Course", topics: ["guitar", "music"], entity: "guitar", local: true, priority: 80 },
    { url: "/courses/piano", title: "دوره آموزش پیانو", type: "Course", topics: ["piano"], entity: "piano", local: true, priority: 70 },
  ];

  it("ranks semantically related targets and never self-links", () => {
    const graph = buildAutonomousLinkGraph(pages, { limit: 2 });
    const guitar = graph.find((node) => node.sourceUrl === "/blog/guitar-guide");
    expect(guitar.links[0].targetUrl).toBe("/courses/guitar");
    expect(guitar.links.some((link) => link.targetUrl === guitar.sourceUrl)).toBe(false);
  });

  it("emits dashboard-ready LINK opportunities with bounded priority", () => {
    const opportunities = buildLinkOpportunities(pages, { limit: 3 });
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities.every((item) => item.action === "LINK")).toBe(true);
    expect(opportunities.every((item) => item.priority >= 0 && item.priority <= 100)).toBe(true);
  });
});
