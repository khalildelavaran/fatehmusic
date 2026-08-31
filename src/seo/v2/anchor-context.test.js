import { describe, expect, it } from "vitest";
import { buildAnchorContextRecommendation, buildAnchorContextRecommendations } from "./anchor-context.js";

describe("anchor context intelligence", () => {
  it("selects a relevant anchor and source context without inventing URLs", () => {
    const source = {
      url: "/blog/guitar-guide",
      title: "راهنمای آموزش گیتار در شوشتر",
      topics: ["guitar", "music"],
      entities: ["guitar-course"],
      content: "برای شروع آموزش گیتار در شوشتر، انتخاب کلاس مناسب اهمیت زیادی دارد. آموزش گیتار با تمرین منظم نتیجه بهتری خواهد داشت."
    };
    const target = {
      url: "/courses/guitar",
      title: "کلاس گیتار در شوشتر",
      anchorLabel: "کلاس گیتار در شوشتر",
      topics: ["guitar"],
      entities: ["guitar-course"]
    };

    const result = buildAnchorContextRecommendation(source, target);
    expect(result?.action).toBe("LINK");
    expect(result?.sourceUrl).toBe(source.url);
    expect(result?.targetUrl).toBe(target.url);
    expect(result?.anchor).toBeTruthy();
    expect(result?.context).toContain("آموزش گیتار");
  });

  it("never recommends self-links", () => {
    const source = { url: "/courses/guitar", title: "گیتار", content: "آموزش گیتار" };
    const target = { url: "/courses/guitar", title: "کلاس گیتار" };
    expect(buildAnchorContextRecommendation(source, target)).toBeNull();
  });

  it("ranks only sufficiently relevant known targets", () => {
    const source = {
      url: "/blog/guitar-guide",
      topics: ["guitar"],
      content: "آموزش گیتار در شوشتر برای هنرجویان علاقه مند به موسیقی."
    };
    const targets = [
      { url: "/courses/guitar", title: "کلاس گیتار در شوشتر", topics: ["guitar"] },
      { url: "/courses/piano", title: "کلاس پیانو", topics: ["piano"] }
    ];
    const results = buildAnchorContextRecommendations([source], targets, { minScore: 35, limit: 5 });
    expect(results.length).toBe(1);
    expect(results[0].targetUrl).toBe("/courses/guitar");
  });
});
