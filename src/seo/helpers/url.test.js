import { describe, expect, it } from "vitest";
import { webPageEntityId, normalizeUrl } from "./url.js";

describe("webPageEntityId", () => {
  it("keeps the root slash but removes trailing slashes from non-root paths", () => {
    expect(webPageEntityId("https://fatehmusic.ir/")).toBe("https://fatehmusic.ir/#webpage");
    expect(webPageEntityId("https://fatehmusic.ir/about/")).toBe("https://fatehmusic.ir/about#webpage");
    expect(webPageEntityId("https://fatehmusic.ir/courses/guitar-course/?utm_source=test")).toBe("https://fatehmusic.ir/courses/guitar-course#webpage");
  });
});


describe("normalizeUrl", () => {
  it("preserves the canonical root and strips tracking components", () => {
    expect(normalizeUrl("https://fatehmusic.ir/")).toBe("https://fatehmusic.ir/");
    expect(normalizeUrl("https://fatehmusic.ir/?utm_source=test#top")).toBe("https://fatehmusic.ir/");
    expect(normalizeUrl("https://fatehmusic.ir/about/?utm_source=test#section")).toBe("https://fatehmusic.ir/about");
  });

  it("normalizes relative paths without turning the root into an empty string", () => {
    expect(normalizeUrl("/")).toBe("/");
    expect(normalizeUrl("/about/")).toBe("/about");
    expect(normalizeUrl("/courses/guitar-course/?x=1")).toBe("/courses/guitar-course");
  });
});
