import { describe, expect, it } from "vitest";
import { isDailyClosed, rejectIfAnyDailyClosed, rejectIfDailyClosed } from "./daily-closure-guard";

type FakeDb = {
  prepare: (sql: string) => {
    bind: (date: string) => {
      first: <T>() => Promise<T | null>;
    };
  };
};

function fakeDb(closedDates: string[] = []): D1Database {
  const closed = new Set(closedDates);
  const db: FakeDb = {
    prepare: () => ({
      bind: (date: string) => ({
        first: async <T>() => (closed.has(date) ? ({ closed: 1 } as T) : null),
      }),
    }),
  };
  return db as unknown as D1Database;
}

describe("daily closure guard", () => {
  it("detects a closed operational date", async () => {
    await expect(isDailyClosed(fakeDb(["2026-09-17"]), "2026-09-17")).resolves.toBe(true);
    await expect(isDailyClosed(fakeDb(), "2026-09-17")).resolves.toBe(false);
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
    await expect(rejectIfDailyClosed(fakeDb(), "2026-09-17")).resolves.toBeNull();
  });

  it("returns a stable DAILY_CLOSED response for a closed day", async () => {
    const response = await rejectIfDailyClosed(fakeDb(["2026-09-17"]), "2026-09-17");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toEqual({
      success: false,
      code: "DAILY_CLOSED",
      message: "این روز بسته شده است و تغییرات عملیاتی جدید برای آن مجاز نیست.",
      date: "2026-09-17",
    });
  });

  it("checks every affected day when a mutation has source and destination dates", async () => {
    const response = await rejectIfAnyDailyClosed(
      fakeDb(["2026-09-18"]),
      ["2026-09-17", "2026-09-18", "2026-09-18"],
    );
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({
      code: "DAILY_CLOSED",
      date: "2026-09-18",
    });
  });

  it("returns no rejection when all affected days are open", async () => {
    await expect(rejectIfAnyDailyClosed(fakeDb(), ["2026-09-17", "2026-09-18"])).resolves.toBeNull();
  });
});
