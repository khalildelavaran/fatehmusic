
describe("content topic listing performance", () => {
  it("keeps the admin read path to one bounded topic query", async () => {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind: (...args: unknown[]) => {
            expect(args).toEqual(["approved", 30]);
            return {
              all: async <T>() => ({ results: [] as T[] })
            };
          }
        };
      }
    } as unknown as D1Database;

    await expect(listTopics(db, { status: "approved", limit: 30 })).resolves.toEqual([]);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("SELECT * FROM content_topics");
    expect(statements[0]).toContain("ORDER BY score_total DESC");
  });
});

import { describe, expect, it } from "vitest";
import { cleanupTopicsCoveredByExistingPosts, getExistingTitleIndex, getRunApprovedCount, listTopics, markTopicPublished, markTopicDraftPost, releaseTopicForDeletedPost } from "../../../src/ai/content-engine/db";

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
        expect(sql).toContain("status IN ('drafted', 'used')");
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


describe("content intelligence existing-post reconciliation", () => {
  it("moves stale duplicate suggestions to the lifecycle state of their matching post", async () => {
    const updates: unknown[][] = [];
    let batchedStatementCount = 0;
    const db = {
      prepare(sql: string) {
        if (sql.includes("FROM content_topics WHERE status IN ('candidate','approved')")) {
          return {
            all: async <T>() => ({
              results: [
                { id: 41, title: "چرا دانستن تئوری موسیقی برای نواختن گیتار مهم است" },
                { id: 42, title: "تمرین روزانه گیتار برای هنرجویان" },
                { id: 43, title: "اشتباهات رایج هنرجویان گیتار" }
              ] as T[]
            })
          };
        }

        if (sql.includes("FROM blog_posts")) {
          return {
            all: async <T>() => ({
              results: [
                {
                  id: 701,
                  title: "چرا دانستن تئوری موسیقی برای نواختن گیتار مهم است؟",
                  status: "published",
                  published_at: "2026-10-10 08:00:00"
                },
                {
                  id: 702,
                  title: "تمرین روزانه گیتار برای هنرجویان؟",
                  status: "draft",
                  published_at: null
                }
              ] as T[]
            })
          };
        }

        if (sql.startsWith("UPDATE content_topics")) {
          return {
            bind: (...args: unknown[]) => {
              updates.push(args);
              return { sql };
            }
          };
        }

        throw new Error("Unexpected SQL in reconciliation test: " + sql);
      },
      batch: async (statements: unknown[]) => {
        batchedStatementCount = statements.length;
        return statements.map(() => ({ meta: { changes: 1 } }));
      }
    } as unknown as D1Database;

    await expect(cleanupTopicsCoveredByExistingPosts(db)).resolves.toBe(2);
    expect(batchedStatementCount).toBe(2);
    expect(updates).toEqual([
      ["used", 701, "used", "2026-10-10 08:00:00", 41],
      ["drafted", 702, "drafted", null, 42]
    ]);
  });
});
