import { describe, expect, it } from "vitest";
import { buildCanonical } from "../builders/canonical.js";

const site = { url: "https://fatehmusic.ir" };

describe("canonical builder", () => {
  it("strips query strings and fragments from an internal absolute override", () => {
    expect(buildCanonical({
      site,
      path: "/courses",
      override: "https://fatehmusic.ir/courses?utm_source=test#details"
    })).toBe("https://fatehmusic.ir/courses");
  });

  it("falls back to the current site path for an external override", () => {
    expect(buildCanonical({
      site,
      path: "/about",
      override: "https://example.com/about"
    })).toBe("https://fatehmusic.ir/about");
  });

  it("normalizes a relative override", () => {
    expect(buildCanonical({
      site,
      override: "/blog/example/?ref=home"
    })).toBe("https://fatehmusic.ir/blog/example");
  });
});
