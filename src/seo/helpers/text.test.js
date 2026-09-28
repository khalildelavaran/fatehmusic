import { describe, expect, it } from "vitest";
import { containsSemanticPhrase, normalizeSemanticText, semanticTokens } from "./text.js";

describe("canonical semantic text layer", () => {
  it("normalizes Persian spelling variants consistently", () => {
    expect(normalizeSemanticText("آموزشِ گيتار‌ در شوشتر")).toBe("آموزشِ گیتار در شوشتر");
  });

  it("preserves token boundaries for phrase matching", () => {
    expect(containsSemanticPhrase("آموزش گیتار در شوشتر", "گیتار")).toBe(true);
    expect(containsSemanticPhrase("آموزش گیتار در شوشتر", "تار")).toBe(false);
    expect(containsSemanticPhrase("کلاس سه‌تار", "سه تار")).toBe(true);
  });

  it("returns stable token sequences", () => {
    expect(semanticTokens("کلاس گیتار در شوشتر")).toEqual(["کلاس", "گیتار", "در", "شوشتر"]);
  });
});
