import { describe, expect, it } from "vitest";
import { buildAhrefsKeywordSignalMap } from "./ahrefs.js";

describe("Ahrefs keyword signal normalization", () => {
  it("normalizes Persian keyword variants into one market-signal key", () => {
    const map = buildAhrefsKeywordSignalMap([
      { keyword: "آموزش گيتار", volume_monthly: 100, keyword_difficulty: 30 },
      { keyword: "آموزش گیتار", volume_monthly: 250, keyword_difficulty: 25 }
    ]);

    expect(map.size).toBe(1);
    const signal = map.get("آموزش گیتار");
    expect(signal?.estimatedVolume).toBe(250);
    expect(signal?.difficulty).toBe(25);
    expect(signal?.source).toBe("ahrefs");
  });

  it("preserves Ahrefs intent and SERP metadata", () => {
    const map = buildAhrefsKeywordSignalMap([
      {
        keyword: "آموزش گیتار",
        volume_monthly: 200,
        keyword_difficulty: 30,
        intents: { transactional: true },
        serp_features: ["featured_snippet", "local_pack"]
      }
    ]);

    const signal = map.get("آموزش گیتار");
    expect(signal?.intents).toEqual({ transactional: true });
    expect(signal?.serpFeatures).toEqual(["featured_snippet", "local_pack"]);
  });

});
