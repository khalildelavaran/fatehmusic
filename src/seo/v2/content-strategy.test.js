import { describe, expect, it } from "vitest";
import { buildContentStrategy, buildUnifiedContentOpportunities, areIntentsCompatible } from "./content-strategy.js";

describe("content strategy deduplication", () => {
  const courses = [
    { slug: "guitar-course", title: "آموزش گیتار", instrument: "guitar" },
    { slug: "traditional-vocal-course", title: "آموزش آواز سنتی", instrument: "vocal" },
    { slug: "children-music-course", title: "آموزش موسیقی کودک", instrument: "children-music" }
  ];

  it("merges local, commercial and transactional gaps for the same local asset", () => {
    const result = buildContentStrategy([{ topic: "shushtar", missingIntents: ["local", "commercial", "transactional"], articleCount: 2, articleSlugs: ["music-education-local"] }]);
    expect(result.briefCount).toBe(1);
    expect(result.briefs[0].searchIntents).toEqual(["transactional", "local", "commercial"]);
    expect(result.briefs[0].suggestedSlug).toBe("music-education-shushtar");
  });

  it("deduplicates equivalent topic-engine candidates instead of using intent as the URL identity", () => {
    const result = buildUnifiedContentOpportunities({
      topicCandidates: [
        { title: "آموزش موسیقی در شوشتر", intent: "local", modifierType: "local_shushtar", scoreTotal: 30 },
        { title: "آموزش موسیقی در شوشتر", intent: "commercial", modifierType: "local_shushtar", scoreTotal: 30 },
        { title: "آموزش موسیقی در شوشتر", intent: "transactional", modifierType: "local_shushtar", scoreTotal: 30 }
      ]
    });
    expect(result.opportunityCount).toBe(1);
    expect(result.opportunities[0].searchIntents).toEqual(["transactional", "local", "commercial"]);
    expect(result.opportunities[0].suggestedSlug).toBe("music-education-shushtar");
  });

  it("does not map the broad music-education topic to a child-music course", () => {
    const result = buildContentStrategy([{ topic: "music-education", missingIntents: ["transactional"], articleCount: 3, articleSlugs: ["music-education-local"] }], courses);
    expect(result.briefCount).toBe(1);
    expect(result.briefs[0].course).toBeNull();
    expect(result.briefs[0].targetEntity.type).toBe("Thing");
  });

  it("keeps informational and transactional intents separate", () => {
    expect(areIntentsCompatible("informational", "transactional")).toBe(false);
    const result = buildContentStrategy([{ topic: "guitar", missingIntents: ["informational", "transactional"], articleCount: 1, articleSlugs: ["guitar-basics"] }]);
    expect(result.briefCount).toBe(2);
  });

  it("does not collapse distinct informational content angles for the same course", () => {
    const result = buildUnifiedContentOpportunities({
      courses,
      topicCandidates: [
        { title: "چگونه گیتار را از صفر یاد بگیریم؟", intent: "informational", modifierType: "how_to", relatedCourseSlug: "guitar-course", scoreTotal: 80 },
        { title: "رایج‌ترین اشتباهات هنرجویان گیتار و راه اصلاح آن‌ها", intent: "informational", modifierType: "mistakes", relatedCourseSlug: "guitar-course", scoreTotal: 78 },
        { title: "تکنیک‌های تمرین مؤثر برای هنرجویان گیتار", intent: "informational", modifierType: "practice_tips", relatedCourseSlug: "guitar-course", scoreTotal: 76 }
      ]
    });
    expect(result.opportunityCount).toBe(3);
  });

  it("merges a local SEO gap with its local course candidate, but not with unrelated angles", () => {
    const result = buildUnifiedContentOpportunities({
      courses,
      gaps: [{ topic: "vocal", scope: "shushtar", missingIntents: ["local", "transactional"], articleCount: 1, articleSlugs: ["vocal-shushtar"] }],
      topicCandidates: [
        { title: "چرا آموزشگاه فاتح برای یادگیری آواز سنتی در شوشتر انتخاب خوبی است", intent: "commercial", modifierType: "local_shushtar", relatedCourseSlug: "traditional-vocal-course", scoreTotal: 88 },
        { title: "چگونه آواز را از صفر یاد بگیریم؟", intent: "informational", modifierType: "how_to", relatedCourseSlug: "traditional-vocal-course", scoreTotal: 86 }
      ]
    });
    expect(result.opportunityCount).toBe(2);
    const local = result.opportunities.find((item) => item.modifierType === "local_shushtar");
    expect(local.searchIntents).toEqual(["transactional", "local", "commercial"]);
    expect(local.course.slug).toBe("traditional-vocal-course");
  });

  it("keeps Course identity for a subject-specific local opportunity", () => {
    const result = buildUnifiedContentOpportunities({
      courses,
      topicCandidates: [{ title: "هزینه کلاس آواز در شوشتر", intent: "transactional", modifierType: "local_shushtar", relatedCourseSlug: "traditional-vocal-course", scoreTotal: 96 }],
      siteUrl: "https://fatehmusic.ir"
    });
    expect(result.opportunityCount).toBe(1);
    expect(result.opportunities[0].topic).toBe("vocal");
    expect(result.opportunities[0].isLocal).toBe(true);
    expect(result.opportunities[0].targetEntity.type).toBe("Course");
    expect(result.opportunities[0].course.slug).toBe("traditional-vocal-course");
    expect(result.opportunities[0].suggestedSlug).toBe("vocal-traditional-vocal-course-shushtar");
  });

  it("does not resolve a local vocal title to the generic shushtar topic", () => {
    const result = buildUnifiedContentOpportunities({
      courses,
      topicCandidates: [{ title: "کلاس آواز در شوشتر", intent: "local", modifierType: "local_shushtar", relatedCourseSlug: "traditional-vocal-course", scoreTotal: 90 }]
    });
    expect(result.opportunities[0].topic).toBe("vocal");
    expect(result.opportunities[0].targetEntity.type).toBe("Course");
  });
});
