import { describe, expect, it } from "vitest";
import { isDailyClosed, rejectIfDailyClosed } from "./daily-closure-guard";

type FakeDb = {
  prepare: (sql: string) => {
    bind: (date: string) => {
      first: <T>() => Promise<T | null>;
    };
  };
};

function fakeDb(closed: boolean): D1Database {
  const db: FakeDb = {
    prepare: () => ({
      bind: () => ({
        first: async <T>() => (closed ? ({ closed: 1 } as T) : null),
      }),
    }),
  };
  return db as unknown as D1Database;
}

describe("daily closure guard", () => {
  it("detects a closed operational date", async () => {
    await expect(isDailyClosed(fakeDb(true), "2026-09-17")).resolves.toBe(true);
    await expect(isDailyClosed(fakeDb(false), "2026-09-17")).resolves.toBe(false);
  });

  it("does not query the database for an invalid date", async () => {
    let queried = false;
    const db = {
      prepare: () => {
        queried = true;
        throw new Error("should not query");
      },
    } as unknown as D1Database;

    await expect(isDailyClosed(db, "17-09-2026")).resolves.toBe(false);
    expect(queried).toBe(false);
  });

  it("returns no rejection for an open day", async () => {
    await expect(rejectIfDailyClosed(fakeDb(false), "2026-09-17")).resolves.toBeNull();
  });

  it("returns a stable DAILY_CLOSED response for a closed day", async () => {
    const response = await rejectIfDailyClosed(fakeDb(true), "2026-09-17");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toEqual({
      success: false,
      code: "DAILY_CLOSED",
      message: "این روز بسته شده است و تغییرات عملیاتی جدید برای آن مجاز نیست.",
      date: "2026-09-17",
    });
  });
});
