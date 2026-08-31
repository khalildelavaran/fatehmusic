import { describe, expect, it } from "vitest";
import { buildArticleLinkCandidates } from "./content-clusters.js";

describe("semantic coverage", () => {
  it("keeps article graph topics canonical instead of raw editorial text", () => {
    const [candidate] = buildArticleLinkCandidates([
      { slug: "guitar-guide", title: "راهنمای آموزش گیتار در شوشتر", topic: "گیتار", excerpt: "کلاس گیتار برای مبتدیان" }
    ], "https://fatehmusic.ir");
    expect(candidate.topics).toEqual(expect.arrayContaining(["guitar", "shushtar"]));
    expect(candidate.topics).not.toContain("راهنمای آموزش گیتار در شوشتر");
    expect(candidate.topics).not.toContain("کلاس گیتار برای مبتدیان");
  });
});
