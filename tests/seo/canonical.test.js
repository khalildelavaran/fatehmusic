import { describe, expect, it } from "vitest";
import { buildCanonical } from "../../src/seo/builders/canonical.js";

const site = { url: "https://fatehmusic.ir" };

describe("canonical builder", () => {
  it("keeps canonical URLs on the site origin", () => {
    expect(buildCanonical({
      site,
      path: "/courses/guitar-course",
      override: "https://example.com/elsewhere"
    })).toBe("https://fatehmusic.ir/courses/guitar-course");
  });

  it("removes query strings and fragments from same-origin overrides", () => {
    expect(buildCanonical({
      site,
      path: "/courses/guitar-course",
      override: "/courses/guitar-course?utm_source=test#faq"
    })).toBe("https://fatehmusic.ir/courses/guitar-course");
  });
});
