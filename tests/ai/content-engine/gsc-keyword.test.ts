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
  it("reads demand only from the current retained snapshot", async () => {
    let sql = "";
    const db = {
      prepare(statement: string) {
        sql = statement;
        return {
          bind() {
            return {
              all: async () => ({
                results: [
                  { query: "آموزش سنتور شوشتر", clicks: 4, impressions: 100, position: 9 }
                ]
              })
            };
          }
        };
      }
    } as unknown as D1Database;

    const provider = new D1SearchConsoleKeywordProvider({ db });
    await provider.lookup("آموزش سنتور در شوشتر");

    expect(sql).toContain("snapshot_label = 'current'");
  });
  it("ignores an invalid ranking position when calculating the weighted signal", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({
                results: [
                  { query: "آموزش نی", clicks: 10, impressions: 1000, position: "invalid" as unknown as number },
                  { query: "کلاس نی", clicks: 4, impressions: 200, position: 8 }
                ]
              })
            };
          }
        };
      }
    } as unknown as D1Database;

    const provider = new D1SearchConsoleKeywordProvider({ db });
    const signal = await provider.lookup("آموزش نی");

    expect(signal.available).toBe(true);
    expect(signal.searchPosition).toBe(8);
  });

  it("does not treat tar as a substring match inside guitar", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({
                results: [
                  { query: "آموزش تار", clicks: 20, impressions: 400, position: 6 },
                  { query: "آموزش گیتار", clicks: 4, impressions: 80, position: 9 }
                ]
              })
            };
          }
        };
      }
    } as unknown as D1Database;

    const provider = new D1SearchConsoleKeywordProvider({ db });
    const signal = await provider.lookup("آموزش گیتار در شوشتر");

    expect(signal.matchedQueries).toContain("آموزش گیتار");
    expect(signal.matchedQueries).not.toContain("آموزش تار");
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
