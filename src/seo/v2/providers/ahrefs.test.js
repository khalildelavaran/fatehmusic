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
});
