import { describe, expect, it } from "vitest";
import { D1SearchConsoleKeywordProvider } from "../../../src/ai/content-engine/providers/gsc-keyword";

describe("D1SearchConsoleKeywordProvider", () => {
  it("uses observed Search Console query demand without inventing monthly volume", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({
                results: [
                  { query: "آموزش گیتار در شوشتر", clicks: 12, impressions: 480, position: 8.5 },
                  { query: "کلاس گیتار شوشتر", clicks: 6, impressions: 220, position: 11.2 }
                ]
              })
            };
          }
        };
      }
    } as unknown as D1Database;

    const provider = new D1SearchConsoleKeywordProvider({ db });
    const signal = await provider.lookup("راهنمای آموزش گیتار در شوشتر");

    expect(signal.available).toBe(true);
    expect(signal.searchImpressions).toBeGreaterThan(0);
    expect(signal.searchCtr).toBeGreaterThan(0);
    expect(signal.estimatedVolume).toBeUndefined();
    expect(signal.source).toBe("google-search-console");
  });
  it("does not let a generic one-word query dominate a specific course topic", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({
                results: [
                  { query: "آموزش", clicks: 500, impressions: 20000, position: 3 },
                  { query: "آموزش ویولن شوشتر", clicks: 8, impressions: 160, position: 9 }
                ]
              })
            };
          }
        };
      }
    } as unknown as D1Database;

    const provider = new D1SearchConsoleKeywordProvider({ db });
    const signal = await provider.lookup("آموزش ویولن در شوشتر");

    expect(signal.available).toBe(true);
    expect(signal.matchedQueries).toContain("آموزش ویولن شوشتر");
    expect(signal.matchedQueries).not.toContain("آموزش");
  });
});
