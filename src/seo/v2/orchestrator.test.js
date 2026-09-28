import { describe, expect, it } from "vitest";
import { buildSEOIntelligence } from "./orchestrator.js";
import { findContentGaps } from "./content-clusters.js";

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
    expect(result.gsc.queryOwnership).toHaveLength(1);
    expect(result.gsc.queryOwnership[0].displayQuery).toBe("کلاس گیتار در شوشتر");
    expect(result.summary.queryOwnershipCount).toBe(1);
    expect(result.summary.decisionConfidenceAverage).toBeGreaterThan(0);
    expect(Array.isArray(result.opportunities)).toBe(true);
  });

  it("exposes market opportunities and the explicit knowledge graph", () => {
    const result = buildSEOIntelligence({
      posts: [{
        slug: "guitar-guide",
        title: "راهنمای گیتار",
        topic: "گیتار",
        related_course_slug: "guitar-course"
      }],
      courses: [{
        id: 1,
        slug: "guitar-course",
        title: "آموزش گیتار",
        instrument: "guitar",
        instructor: 7
      }],
      instructors: [{
        id: 7,
        slug: "ali",
        name: "علی",
        professional: { roles: ["مدرس گیتار"] }
      }],
      marketKeywordRows: [{
        keyword: "آموزش گیتار شوشتر",
        volume_monthly: 250,
        keyword_difficulty: 30,
        best_position: 16,
        best_position_url: "https://fatehmusic.ir/courses/guitar-course"
      }],
      gscRows: [],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.marketOpportunities).toHaveLength(1);
    expect(result.marketOpportunities[0].classification).toBe("STRIKING_DISTANCE");
    expect(result.knowledgeGraph.statistics.nodeCount).toBeGreaterThanOrEqual(6);
    expect(result.knowledgeGraph.statistics.edgeCount).toBeGreaterThanOrEqual(5);
    expect(result.knowledgeGraphValidation.valid).toBe(true);
  });

  it("rejects a stale broad local candidate that points at a specific course", () => {
    const result = buildSEOIntelligence({
      posts: [],
      courses: [{ slug: "children-music-course", title: "آموزش موسیقی کودک", instrument: "children-music" }],
      topicCandidates: [{
        title: "آموزش موسیقی در شوشتر | راهنمای کلاس و انتخاب دوره",
        relatedCourseSlug: "children-music-course",
        modifierType: "local_shushtar",
        intent: "local",
        scoreTotal: 90
      }],
      gscRows: [],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.opportunities).toEqual([]);
  });

  it("keeps a subject-specific local candidate linked to its course", () => {
    const result = buildSEOIntelligence({
      posts: [],
      courses: [{ slug: "traditional-vocal-course", title: "آموزش آواز سنتی", instrument: "vocal" }],
      topicCandidates: [{
        title: "هزینه کلاس آواز در شوشتر",
        relatedCourseSlug: "traditional-vocal-course",
        modifierType: "local_shushtar",
        intent: "transactional",
        scoreTotal: 90
      }],
      gscRows: [],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].topic).toBe("vocal");
    expect(result.opportunities[0].course.slug).toBe("traditional-vocal-course");
  });

  it("keeps a comparison article on its declared course topic instead of every title-mentioned instrument", () => {
    const gaps = findContentGaps([
      {
        slug: "violin-kamancheh-comparison",
        title: "ویولن یا کمانچه؛ مقایسه‌ای برای انتخاب ساز مناسب شما",
        excerpt: "مقایسه ویولن و کمانچه برای انتخاب دوره",
        topic: "کمانچه",
        related_course_slug: "kamancheh-course"
      }
    ], ["informational", "commercial", "transactional", "local"]);

    expect(gaps).toHaveLength(4);
    expect(gaps.every((gap) => gap.topic === "kamancheh")).toBe(true);
    expect(gaps.every((gap) => gap.courseSlug === "kamancheh-course")).toBe(true);
  });

  it("builds the link graph from canonical site pages as well as articles", () => {
    const result = buildSEOIntelligence({
      posts: [{ slug: "guitar-guide", title: "آموزش گیتار", topic: "گیتار", excerpt: "راهنمای گیتار" }],
      courses: [],
      topicCandidates: [],
      gscRows: [],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.links.graph.some((node) => node.url === "https://fatehmusic.ir/courses")).toBe(true);
    expect(result.links.graph.some((node) => node.url === "https://fatehmusic.ir/gallery")).toBe(true);
    expect(result.links.graph.some((node) => node.url === "https://fatehmusic.ir/locations/shushtar")).toBe(true);
    expect(result.links.graph.some((node) => node.url === "https://fatehmusic.ir/blog/guitar-guide")).toBe(true);
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


  it("feeds Ahrefs market data into the core opportunity score", () => {
    const result = buildSEOIntelligence({
      courses: [{ slug: "guitar", title: "آموزش گیتار", instrument: "guitar" }],
      topicCandidates: [{
        title: "آموزش گیتار",
        intent: "commercial",
        modifierType: "course",
        relatedCourseSlug: "guitar",
        scoreTotal: 80
      }],
      marketKeywordRows: [{
        keyword: "آموزش گیتار",
        volume_monthly: 200,
        keyword_difficulty: 30,
        best_position: 18
      }],
      siteUrl: "https://fatehmusic.ir"
    });

    expect(result.marketOpportunities).toHaveLength(1);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].marketSignal.available).toBe(true);
    expect(result.opportunities[0].marketSignal.estimatedVolume).toBe(200);
    expect(result.opportunities[0].scoreBreakdown.marketSignal).not.toBeNull();
  });
});
