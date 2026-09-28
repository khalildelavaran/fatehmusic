import { describe, expect, it } from "vitest";
import { courses } from "../../src/data/courses.js";
import { buildUnifiedContentOpportunities } from "../../src/seo/v2/content-strategy.js";
import { toDedupKey } from "../../src/ai/content-engine/normalize";

describe("comparison content strategy", () => {
  it("keeps distinct comparison topics as separate opportunities", () => {
    const makeCandidate = (title: string, slugA: string, slugB: string) => ({
      title,
      normalizedKey: toDedupKey(title),
      instrumentKey: slugA.replace("-course", ""),
      relatedCourseSlug: slugA,
      relatedCourseTitle: "آموزش " + slugA.replace("-course", ""),
      category: "سازهای زهی",
      audience: "",
      level: "",
      modifierType: "comparison" as const,
      intent: "commercial" as const,
      source: "test",
      scoreTotal: 70,
      scoreBreakdown: {
        businessFit: 28, contentGap: 10, localRelevance: 5,
        intentQuality: 10, keywordSignal: 15, freshnessPenalty: 0
      },
      reasoning: "test"
    });

    const result = buildUnifiedContentOpportunities({
      courses,
      siteUrl: "https://fatehmusic.ir",
      topicCandidates: [
        makeCandidate("تفاوت تار و سه‌تار در چیست؟ کدام را انتخاب کنیم", "tar-course", "setar-course"),
        makeCandidate("ویولن یا کمانچه؛ مقایسه‌ای برای انتخاب ساز مناسب شما", "violin-course", "kamancheh-course")
      ]
    });

    const comparisons = result.opportunities.filter((item) => item.modifierType === "comparison");
    expect(comparisons).toHaveLength(2);
    expect(new Set(comparisons.map((item) => item.suggestedSlug)).size).toBe(2);
  });

  it("keeps comparison topics multi-course instead of attaching them to one course", () => {
    const title = "تفاوت تار و سه‌تار در چیست؟ کدام را انتخاب کنیم";
    const result = buildUnifiedContentOpportunities({
      courses,
      siteUrl: "https://fatehmusic.ir",
      topicCandidates: [{
        title,
        normalizedKey: toDedupKey(title),
        instrumentKey: "tar",
        relatedCourseSlug: "tar-course",
        relatedCourseTitle: "آموزش تار",
        category: "سازهای زهی",
        audience: "",
        level: "",
        modifierType: "comparison",
        intent: "commercial",
        source: "test",
        scoreTotal: 70,
        scoreBreakdown: {
          businessFit: 28,
          contentGap: 10,
          localRelevance: 5,
          intentQuality: 10,
          keywordSignal: 15,
          freshnessPenalty: 0
        },
        reasoning: "test"
      }]
    });

    const comparison = result.opportunities[0];
    expect(comparison).toBeTruthy();
    expect(comparison.course).toBeNull();
    expect(comparison.targetEntity.type).not.toBe("Course");
    expect(comparison.comparisonCourses).toHaveLength(2);
    expect(comparison.comparisonCourses.map((item: { slug: string } | null) => item?.slug)).toEqual(
      expect.arrayContaining(["tar-course", "setar-course"])
    );
    expect(comparison.suggestedSlug.startsWith("comparison-")).toBe(true);
    expect(comparison.recommendedLinks).toEqual(
      expect.arrayContaining([
        "https://fatehmusic.ir/courses/tar-course",
        "https://fatehmusic.ir/courses/setar-course"
      ])
    );
  });
});
