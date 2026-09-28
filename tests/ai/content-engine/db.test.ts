import { describe, expect, it } from "vitest";
import { getExistingTitleIndex, getRunApprovedCount } from "../../../src/ai/content-engine/db";

describe("content intelligence title index", () => {
  it("does not let rejected topics permanently block a title", async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql);
        return {
          all: async <T>() => {
            if (sql.includes("content_topics")) {
              return {
                results: [
                  { title: "موضوع تأییدشده", normalized_key: "موضوع تاییدشده" }
                ] as T[]
              };
            }
            return {
              results: [
                { title: "مقاله منتشرشده" }
              ] as T[]
            };
          }
        };
      }
    } as unknown as D1Database;

    const index = await getExistingTitleIndex(db);

    expect(index.titles).toEqual(["موضوع تأییدشده", "مقاله منتشرشده"]);
    expect(index.normalizedKeys.has("موضوع تاییدشده")).toBe(true);
    expect(index.normalizedKeys.has("مقاله منتشرشده")).toBe(true);
    expect(calls[0]).toContain("WHERE status != 'rejected'");
  });
});


describe("content intelligence discovery run counts", () => {
  it("reads the persisted approved count for the current run", async () => {
    const db = {
      prepare(sql: string) {
        expect(sql).toContain("FROM content_topics");
        expect(sql).toContain("run_id = ?");
        expect(sql).toContain("status = 'approved'");
        return {
          bind: (...args: unknown[]) => {
            expect(args).toEqual([42]);
            return {
              first: async <T>() => ({ count: 3 } as T)
            };
          }
        };
      }
    } as unknown as D1Database;

    await expect(getRunApprovedCount(db, 42)).resolves.toBe(3);
  });
});
