import { describe, expect, it, vi } from "vitest";
import { createNotification, NOTIFICATION_TYPES, NOTIFICATION_RECIPIENT_TYPES } from "./in-app-notifications";

function fakeDb(overrides: Partial<Record<string, any>> = {}) {
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } });
  const bind = vi.fn().mockReturnValue({ run, first: vi.fn().mockResolvedValue(null), all: vi.fn().mockResolvedValue({ results: [] }) });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { prepare, ...overrides } as unknown as D1Database;
}

describe("NOTIFICATION_TYPES / NOTIFICATION_RECIPIENT_TYPES", () => {
  it("includes all seven types from the spec", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "class_reminder",
      "payment_due",
      "attendance",
      "assignment",
      "evaluation",
      "certificate",
      "system",
    ]);
  });

  it("includes all four recipient types", () => {
    expect(NOTIFICATION_RECIPIENT_TYPES).toEqual(["admin", "registrar", "instructor", "student"]);
  });
});

describe("createNotification", () => {
  it("rejects an invalid recipientType without touching the database", async () => {
    const db = fakeDb();
    const ok = await createNotification(db, { recipientType: "hacker" as any, type: "system", title: "x" });
    expect(ok).toBe(false);
    expect((db as any).prepare).not.toHaveBeenCalled();
  });

  it("rejects an invalid type without touching the database", async () => {
    const db = fakeDb();
    const ok = await createNotification(db, { recipientType: "student", type: "not_a_type" as any, title: "x" });
    expect(ok).toBe(false);
    expect((db as any).prepare).not.toHaveBeenCalled();
  });

  it("rejects an empty title", async () => {
    const db = fakeDb();
    const ok = await createNotification(db, { recipientType: "student", type: "system", title: "   " });
    expect(ok).toBe(false);
  });

  it("returns true and calls prepare/bind/run for a valid notification", async () => {
    const db = fakeDb();
    const ok = await createNotification(db, { recipientType: "student", recipientId: 1, type: "assignment", title: "تمرین جدید" });
    expect(ok).toBe(true);
    expect((db as any).prepare).toHaveBeenCalledTimes(1);
  });

  it("returns false (not throws) if the database write fails", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: vi.fn().mockRejectedValue(new Error("db down")) }),
      }),
    } as unknown as D1Database;
    const ok = await createNotification(db, { recipientType: "student", type: "system", title: "x" });
    expect(ok).toBe(false);
  });
});
