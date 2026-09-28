import { describe, expect, it } from "vitest";
import { getExistingTitleIndex, getRunApprovedCount, markTopicPublished, markTopicDraftPost, releaseTopicForDeletedPost } from "../../../src/ai/content-engine/db";

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
    expect(calls[0]).toContain("status != 'rejected' OR updated_at >= datetime('now', '-30 days')");
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


describe("content intelligence draft lifecycle", () => {
  it("promotes a drafted topic only when its linked post is published", async () => {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind: (...args: unknown[]) => {
            expect(args).toEqual([77]);
            return {
              run: async () => ({ meta: { changes: 1 } })
            };
          }
        };
      }
    } as unknown as D1Database;

    await expect(markTopicPublished(db, 77)).resolves.toBe(1);
    expect(statements[0]).toContain("status='used'");
    expect(statements[0]).toContain("status='drafted'");
  });

  it("releases a drafted topic back to approved when its draft is removed", async () => {
    const db = {
      prepare(sql: string) {
        expect(sql).toContain("status='approved'");
        expect(sql).toContain("status='drafted'");
        return {
          bind: (...args: unknown[]) => {
            expect(args).toEqual([88]);
            return {
              run: async () => ({ meta: { changes: 1 } })
            };
          }
        };
      }
    } as unknown as D1Database;

    await expect(releaseTopicForDeletedPost(db, 88)).resolves.toBe(1);
  });
});


describe("content intelligence post transitions", () => {
  it("moves a published topic back to drafted when its post is edited to draft", async () => {
    const db = {
      prepare(sql: string) {
        expect(sql).toContain("status='drafted'");
        expect(sql).toContain("status='used'");
        return {
          bind: (...args: unknown[]) => {
            expect(args).toEqual([99]);
            return { run: async () => ({ meta: { changes: 1 } }) };
          }
        };
      }
    } as unknown as D1Database;

    await expect(markTopicDraftPost(db, 99)).resolves.toBe(1);
  });
});
