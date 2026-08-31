import { describe, expect, it } from "vitest";
import { buildArticleProfiles, scoreArticleRelation, buildArticleClusterLinks, findContentGaps, buildContentClusterReport, buildArticleLinkCandidates } from "../v2/content-clusters.js";
import { buildContentStrategy, buildUnifiedContentOpportunities } from "../v2/content-strategy.js";

describe("Content Cluster Engine", () => {
  const posts = [
    { slug: "guitar-basics", title: "آموزش گیتار برای مبتدیان در شوشتر", excerpt: "راهنمای شروع یادگیری گیتار", topic: "گیتار", related_course_slug: "guitar-course", content: "شروع یادگیری گیتار با تمرین منظم." },
    { slug: "choose-guitar", title: "چگونه گیتار مناسب انتخاب کنیم؟", excerpt: "راهنمای انتخاب گیتار", topic: "گیتار", related_course_slug: "guitar-course", content: "برای انتخاب گیتار باید به هدف یادگیری توجه کرد." },
    { slug: "piano-start", title: "شروع آموزش پیانو", excerpt: "راهنمای شروع پیانو", topic: "پیانو", related_course_slug: "piano-course", content: "آشنایی با پیانو و تمرین روزانه." }
  ];
  const courses = [
    { slug: "guitar-course", title: "آموزش گیتار", instrument: "guitar" },
    { slug: "piano-course", title: "آموزش پیانو", instrument: "piano" }
  ];

  it("profiles articles and resolves topics", () => { const profiles = buildArticleProfiles(posts); expect(profiles).toHaveLength(3); expect(profiles[0].topics).toContain("guitar"); });
  it("strongly relates shared topic/course articles", () => { const profiles = buildArticleProfiles(posts); expect(scoreArticleRelation(profiles[0], profiles[1])).toBeGreaterThan(50); });
  it("creates non-self related links", () => { const links = buildArticleClusterLinks(posts, 2); expect(links[0].related.every((item) => item.slug !== links[0].slug)).toBe(true); });
  it("detects missing topic intent coverage", () => { const guitar = findContentGaps(posts).find((gap) => gap.topic === "guitar"); expect(guitar).toBeTruthy(); expect(guitar.missingIntents).toContain("transactional"); });
  it("builds a complete cluster report", () => { const report = buildContentClusterReport(posts, { courses }); expect(report.articleCount).toBe(3); expect(report.gaps.length).toBeGreaterThan(0); expect(report.strategy.briefCount).toBeGreaterThan(0); });
  it("turns gaps into actionable production briefs", () => {
    const strategy = buildContentStrategy(findContentGaps(posts), courses);
    const item = strategy.briefs.find((brief) => brief.topic === "guitar" && brief.searchIntent === "transactional");
    expect(item).toBeTruthy(); expect(item.title).toContain("هزینه"); expect(item.targetEntity.type).toBe("Course"); expect(item.course.slug).toBe("guitar-course"); expect(item.priority).toBeGreaterThan(80); expect(item.queryAngles.length).toBeGreaterThan(1);
  });
  it("merges topic-engine candidates and SEO gaps into one deduplicated queue", () => {
    const unified = buildUnifiedContentOpportunities({
      gaps: findContentGaps(posts),
      courses,
      topicCandidates: [
        { id: 10, title: "هزینه کلاس گیتار", instrumentKey: "guitar", relatedCourseSlug: "guitar-course", relatedCourseTitle: "آموزش گیتار", intent: "transactional", scoreTotal: 96, modifierType: "local_shushtar", reasoning: "candidate" },
        { id: 11, title: "راهنمای تمرین گیتار", instrumentKey: "guitar", relatedCourseSlug: "guitar-course", relatedCourseTitle: "آموزش گیتار", intent: "informational", scoreTotal: 88, modifierType: "practice_tips", reasoning: "candidate" }
      ],
      siteUrl: "https://fatehmusic.ir"
    });
    const transactional = unified.opportunities.filter((item) => item.topic === "guitar" && item.searchIntent === "transactional");
    expect(transactional).toHaveLength(1);
    expect(transactional[0].source).toBe("topic-engine");
    expect(unified.opportunityCount).toBe(unified.opportunities.length);
  });
  it("emits canonical topic slugs for article link candidates", () => {
    const candidates = buildArticleLinkCandidates(posts, "https://fatehmusic.ir");
    const guitar = candidates.find((item) => item.url.endsWith("/blog/guitar-basics"));
    const piano = candidates.find((item) => item.url.endsWith("/blog/piano-start"));
    expect(guitar.topics).toContain("guitar");
    expect(guitar.topics).not.toContain("آموزش گیتار برای مبتدیان در شوشتر");
    expect(piano.topics).toContain("piano");
  });
});
