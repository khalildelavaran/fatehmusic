import { describe, expect, it } from "vitest";
import { buildContentStrategy, buildUnifiedContentOpportunities, areIntentsCompatible } from "./content-strategy.js";

describe("content strategy deduplication", () => {
  it("merges local, commercial and transactional gaps for the same local asset", () => {
    const result = buildContentStrategy([
      { topic: "shushtar", missingIntents: ["local", "commercial", "transactional"], articleCount: 2, articleSlugs: ["music-education-local"] }
    ]);
    expect(result.briefCount).toBe(1);
    expect(result.briefs[0].searchIntents).toEqual(["local", "commercial", "transactional"]);
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
    expect(result.opportunities[0].searchIntents).toEqual(["local", "commercial", "transactional"]);
    expect(result.opportunities[0].suggestedSlug).toBe("music-education-shushtar");
  });

  it("does not map the broad music-education topic to a child-music course", () => {
    const result = buildContentStrategy([
      { topic: "music-education", missingIntents: ["transactional"], articleCount: 3, articleSlugs: ["music-education-local"] }
    ], [{ slug: "children-music-course", title: "آموزش موسیقی کودک", description: "دوره آموزش موسیقی کودک" }]);
    expect(result.briefCount).toBe(1);
    expect(result.briefs[0].course).toBeNull();
    expect(result.briefs[0].targetEntity.type).toBe("Thing");
  });

  it("keeps informational and transactional intents separate", () => {
    expect(areIntentsCompatible("informational", "transactional")).toBe(false);
    const result = buildContentStrategy([
      { topic: "guitar", missingIntents: ["informational", "transactional"], articleCount: 1, articleSlugs: ["guitar-basics"] }
    ]);
    expect(result.briefCount).toBe(2);
  });
});
