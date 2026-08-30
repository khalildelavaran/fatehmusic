import { describe, expect, it } from "vitest";
import { buildArticleProfiles, scoreArticleRelation, buildArticleClusterLinks, findContentGaps, buildContentClusterReport } from "../v2/content-clusters.js";

describe("Content Cluster Engine", () => {
  const posts = [
    { slug: "guitar-basics", title: "آموزش گیتار برای مبتدیان در شوشتر", excerpt: "راهنمای شروع یادگیری گیتار", topic: "گیتار", related_course_slug: "guitar-course", content: "شروع یادگیری گیتار با تمرین منظم." },
    { slug: "choose-guitar", title: "چگونه گیتار مناسب انتخاب کنیم؟", excerpt: "راهنمای انتخاب گیتار", topic: "گیتار", related_course_slug: "guitar-course", content: "برای انتخاب گیتار باید به هدف یادگیری توجه کرد." },
    { slug: "piano-start", title: "شروع آموزش پیانو", excerpt: "راهنمای شروع پیانو", topic: "پیانو", related_course_slug: "piano-course", content: "آشنایی با پیانو و تمرین روزانه." }
  ];

  it("profiles articles and resolves topics", () => {
    const profiles = buildArticleProfiles(posts);
    expect(profiles).toHaveLength(3);
    expect(profiles[0].topics).toContain("guitar");
  });

  it("strongly relates shared topic/course articles", () => {
    const profiles = buildArticleProfiles(posts);
    expect(scoreArticleRelation(profiles[0], profiles[1])).toBeGreaterThan(50);
  });

  it("creates non-self related links", () => {
    const links = buildArticleClusterLinks(posts, 2);
    expect(links[0].related.every((item) => item.slug !== links[0].slug)).toBe(true);
  });

  it("detects missing topic intent coverage", () => {
    const guitar = findContentGaps(posts).find((gap) => gap.topic === "guitar");
    expect(guitar).toBeTruthy();
    expect(guitar.missingIntents).toContain("transactional");
  });

  it("builds a complete cluster report", () => {
    const report = buildContentClusterReport(posts);
    expect(report.articleCount).toBe(3);
    expect(report.gaps.length).toBeGreaterThan(0);
  });
});
