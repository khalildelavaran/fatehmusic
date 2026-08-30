import { describe, expect, it } from "vitest";
import {
  buildArticleProfiles,
  scoreArticleRelation,
  buildArticleClusterLinks,
  findContentGaps,
  buildContentClusterReport,
  buildArticleLinkCandidates
} from "../v2/content-clusters.js";

describe("Content Cluster Engine", () => {
  const posts = [
    {
      slug: "guitar-basics",
      title: "آموزش گیتار برای مبتدیان در شوشتر",
      excerpt: "راهنمای شروع یادگیری گیتار",
      topic: "گیتار",
      related_course_slug: "guitar-course",
      content: "شروع یادگیری گیتار با تمرین منظم و آشنایی با آکوردها."
    },
    {
      slug: "choose-guitar",
      title: "چگونه گیتار مناسب انتخاب کنیم؟",
      excerpt: "راهنمای انتخاب گیتار",
      topic: "گیتار",
      related_course_slug: "guitar-course",
      content: "برای انتخاب گیتار باید به هدف یادگیری و بودجه توجه کرد."
    },
    {
      slug: "piano-start",
      title: "شروع آموزش پیانو",
      excerpt: "راهنمای شروع پیانو",
      topic: "پیانو",
      related_course_slug: "piano-course",
      content: "آشنایی با پیانو و تمرین روزانه برای شروع."
    }
  ];

  it("profiles articles with deterministic topics and intent", () => {
    const profiles = buildArticleProfiles(posts);
    expect(profiles).toHaveLength(3);
    expect(profiles[0].topics).toContain("guitar");
    expect(profiles[0].intent).toBeTruthy();
  });

  it("scores articles sharing a topic and course", () => {
    const profiles = buildArticleProfiles(posts);
    const score = scoreArticleRelation(profiles[0], profiles[1]);
    expect(score).toBeGreaterThan(50);
  });

  it("builds related article links and never links the current article", () => {
    const links = buildArticleClusterLinks(posts, 2);
    expect(links[0].related.every((item) => item.slug !== links[0].slug)).toBe(true);
    expect(links[0].related[0].sharedTopics).toContain("guitar");
  });

  it("finds missing intent coverage for existing topic clusters", () => {
    const gaps = findContentGaps(posts);
    const guitar = gaps.find((gap) => gap.topic === "guitar");
    expect(guitar).toBeTruthy();
    expect(guitar.missingIntents).toContain("transactional");
  });

  it("returns a complete cluster report", () => {
    const report = buildContentClusterReport(posts);
    expect(report.articleCount).toBe(3);
    expect(report.topicCount).toBeGreaterThanOrEqual(2);
    expect(report.gaps.length).toBeGreaterThan(0);
  });

  it("turns published posts into safe global link candidates", () => {
    const candidates = buildArticleLinkCandidates(posts, "https://fatehmusic.ir");
    expect(candidates).toHaveLength(3);
    expect(candidates[0].url).toContain("/blog/");
    expect(candidates[0].type).toBe("Article");
  });
});
