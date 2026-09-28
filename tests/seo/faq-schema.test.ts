import { describe, expect, it } from "vitest";
import { buildFaqSchema } from "../../src/seo/schema/faq.js";

describe("FAQ schema", () => {
  it("mirrors visible FAQ items into one FAQPage node", () => {
    const schema = buildFaqSchema([
      { question: "سوال اول", answer: "پاسخ اول" },
      { question: "سوال دوم", answer: "پاسخ دوم" }
    ], {
      site: { url: "https://fatehmusic.ir" },
      url: "https://fatehmusic.ir/courses/guitar-course",
      name: "سوالات متداول درباره آموزش گیتار"
    });

    expect(schema?.["@type"]).toBe("FAQPage");
    expect(schema?.mainEntity).toHaveLength(2);
    expect(schema?.mainEntity?.[0]?.name).toBe("سوال اول");
    expect(schema?.mainEntity?.[0]?.acceptedAnswer?.text).toBe("پاسخ اول");
  });

  it("returns null when there are no usable FAQ entries", () => {
    expect(buildFaqSchema([
      { question: "", answer: "پاسخ" },
      { question: "سوال", answer: "" }
    ], {
      site: { url: "https://fatehmusic.ir" },
      url: "https://fatehmusic.ir/test"
    })).toBeNull();
  });
});
