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


describe("Ahrefs competitor keyword discovery", () => {
  it("accepts a target override for competitor keyword snapshots", async () => {
    const requests: Array<URL> = [];
    const fetchImpl = async (url: URL) => {
      requests.push(url);
      return new Response(JSON.stringify({ keywords: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const { createAhrefsClient } = await import("./ahrefs.js");
    const client = createAhrefsClient({
      AHREFS_API_KEY: "test",
      AHREFS_COUNTRY: "IR",
      AHREFS_TARGET_URL: "https://fatehmusic.ir"
    }, fetchImpl as typeof fetch);

    await client.organicKeywords({
      target: "https://competitor.example",
      country: "IR",
      mode: "domain",
      date: "2026-09-29",
      limit: 25
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("target")).toBe("https://competitor.example");
    expect(requests[0].searchParams.get("mode")).toBe("domain");
    expect(requests[0].searchParams.get("country")).toBe("IR");
    expect(requests[0].searchParams.get("limit")).toBe("25");
  });
});
