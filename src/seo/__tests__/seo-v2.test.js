import { describe, expect, it } from "vitest";
import { buildSEO } from "../index.js";
import { resolveTopics } from "../v2/topics.js";
import { classifyIntent } from "../v2/intents.js";
import { buildInternalLinkPlan } from "../v2/internal-links.js";
import { auditPage } from "../v2/audit.js";


describe("SEO/GEO Engine v2", () => {
  it("resolves local and course topics", () => {
    const topics = resolveTopics({
      title: "آموزش گیتار در شوشتر",
      keywords: ["کلاس گیتار شوشتر"]
    });

    expect(topics.map((topic) => topic.slug)).toEqual(
      expect.arrayContaining(["guitar", "shushtar"])
    );
  });

  it("classifies course registration intent", () => {
    const result = classifyIntent({
      path: "/register",
      title: "ثبت نام کلاس گیتار شوشتر",
      entityType: "Course"
    });

    expect(result.primary).toBe("transactional");
    expect(result.intents[0].score).toBeGreaterThan(0);
  });

  it("ranks related instructors and courses without inventing URLs", () => {
    const links = buildInternalLinkPlan({
      currentUrl: "https://fatehmusic.ir/courses/guitar-course",
      currentTopics: ["guitar", "shushtar"],
      currentType: "Course",
      candidates: [
        {
          url: "https://fatehmusic.ir/instructors/khalil-delavaran",
          title: "خلیل دلاوران",
          type: "Instructor",
          topics: ["guitar", "music-education"],
          local: true
        },
        {
          url: "https://fatehmusic.ir/courses/piano-course",
          title: "آموزش پیانو",
          type: "Course",
          topics: ["piano"],
          local: true
        }
      ]
    });

    expect(links[0].url).toContain("/instructors/");
    expect(links).toHaveLength(2);
  });

  it("normalizes audit score using only available checks", () => {
    const audit = auditPage({
      metadata: {
        title: "آموزش گیتار در شوشتر | آموزشگاه موسیقی فاتح",
        description: "کلاس آموزش گیتار در شوشتر برای هنرجویان مبتدی تا پیشرفته در آموزشگاه موسیقی فاتح.",
        robots: "index,follow"
      },
      url: "https://fatehmusic.ir/courses/guitar-course",
      canonical: "https://fatehmusic.ir/courses/guitar-course",
      schemaGraph: {
        "@graph": [
          { "@id": "https://fatehmusic.ir/#organization" },
          { "@id": "https://fatehmusic.ir/#website" },
          { "@id": "https://fatehmusic.ir/courses/guitar-course/#course" }
        ]
      },
      topicSlugs: ["guitar", "shushtar"],
      primaryIntent: "commercial",
      h1Count: 1,
      wordCount: 600,
      internalLinkCount: 5,
      missingImageAlt: 0
    });

    expect(audit.score).toBeGreaterThanOrEqual(90);
    expect(audit.errors).toHaveLength(0);
  });

  it("boosts links supported by explicit knowledge-graph relationships", () => {
    const links = buildInternalLinkPlan({
      currentUrl: "https://fatehmusic.ir/instructors/ali",
      currentTopics: ["guitar"],
      currentType: "Instructor",
      candidates: [
        {
          url: "https://fatehmusic.ir/courses/guitar-course",
          title: "آموزش گیتار",
          type: "Course",
          topics: ["guitar"]
        },
        {
          url: "https://fatehmusic.ir/courses/piano-course",
          title: "آموزش پیانو",
          type: "Course",
          topics: ["piano"]
        }
      ],
      semanticGraph: {
        nodes: [
          { id: "https://fatehmusic.ir/instructors/ali#person", url: "https://fatehmusic.ir/instructors/ali" },
          { id: "https://fatehmusic.ir/courses/guitar-course#course", url: "https://fatehmusic.ir/courses/guitar-course" },
          { id: "https://fatehmusic.ir/courses/piano-course#course", url: "https://fatehmusic.ir/courses/piano-course" }
        ],
        edges: [
          {
            from: "https://fatehmusic.ir/instructors/ali#person",
            relation: "teaches",
            to: "https://fatehmusic.ir/courses/guitar-course#course",
            confidence: 1
          }
        ]
      }
    });

    expect(links[0].url).toContain("/courses/guitar-course");
    expect(links[0].relationEvidence).toContain("teaches");
  });

  it("builds automatic internal-link recommendations when no custom links are supplied", () => {
    const result = buildSEO({
      path: "/blog/guitar-guide",
      title: "راهنمای یادگیری گیتار در شوشتر",
      description: "راهنمای عملی یادگیری گیتار در شوشتر برای شروع مسیر نوازندگی.",
      keywords: ["گیتار", "شوشتر"],
      entityType: "Article"
    });

    expect(result.geo.internalLinks.length).toBeGreaterThan(0);
    expect(result.geo.internalLinks.some((link) => link.url.includes("/courses/"))).toBe(true);
  });

  it("uses Article Open Graph type for blog pages", () => {
    const result = buildSEO({
      path: "/blog/guitar-guide",
      title: "راهنمای یادگیری گیتار",
      description: "راهنمای عملی یادگیری گیتار برای شروع مسیر نوازندگی.",
      entityType: "Article"
    });

    expect(result.openGraph["og:type"]).toBe("article");
  });

  it("adds v2 semantic signals to buildSEO", () => {
    const result = buildSEO({
      path: "/courses/guitar-course",
      title: "آموزش گیتار در شوشتر",
      description: "دوره آموزش گیتار آموزشگاه موسیقی فاتح در شوشتر برای سطوح مختلف.",
      keywords: ["آموزش گیتار شوشتر"],
      entityType: "Course",
      answerBlocks: [{
        question: "آیا برای شروع گیتار پیش‌نیاز لازم است؟",
        answer: "خیر، مسیر آموزش از سطح مبتدی شروع می‌شود."
      }]
    });

    expect(result.geo.topics.map((topic) => topic.slug)).toEqual(
      expect.arrayContaining(["guitar", "shushtar"])
    );
    expect(result.geo.intent.primary).toBe("local");
    expect(result.geo.answerBlocks).toHaveLength(1);
    expect(result.schemaGraph["@graph"].some((node) => node["@id"] === "https://fatehmusic.ir/#topic-guitar")).toBe(true);
  });
});
