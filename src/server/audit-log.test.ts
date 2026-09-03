import { describe, expect, it } from "vitest";
import { normalizeAuditLogListParams, validateAuditEvent } from "./audit-log";

describe("validateAuditEvent", () => {
  it("accepts a well-formed event", () => {
    expect(() =>
      validateAuditEvent({
        actor: { type: "admin" },
        action: "evaluation.create",
        entityType: "evaluation",
      }),
    ).not.toThrow();
  });

  it("rejects an invalid actor type", () => {
    expect(() =>
      validateAuditEvent({
        actor: { type: "hacker" as any },
        action: "evaluation.create",
        entityType: "evaluation",
      }),
    ).toThrow();
  });

  it("rejects a missing action or entityType", () => {
    expect(() => validateAuditEvent({ actor: { type: "admin" }, action: "", entityType: "evaluation" })).toThrow();
    expect(() => validateAuditEvent({ actor: { type: "admin" }, action: "x", entityType: "" })).toThrow();
  });
});

describe("normalizeAuditLogListParams", () => {
  it("applies defaults when nothing is provided", () => {
    const result = normalizeAuditLogListParams({});
    expect(result).toEqual({
      entityType: null,
      entityId: null,
      actorType: null,
      page: 1,
      pageSize: 50,
      offset: 0,
    });
  });

  it("clamps pageSize to the maximum", () => {
    expect(normalizeAuditLogListParams({ pageSize: 10000 }).pageSize).toBe(200);
    expect(normalizeAuditLogListParams({ pageSize: 0 }).pageSize).toBe(1);
  });

  it("only accepts a known actorType", () => {
    expect(normalizeAuditLogListParams({ actorType: "admin" as any }).actorType).toBe("admin");
    expect(normalizeAuditLogListParams({ actorType: "bogus" as any }).actorType).toBeNull();
  });

  it("computes offset from page and pageSize", () => {
    expect(normalizeAuditLogListParams({ page: 3, pageSize: 10 }).offset).toBe(20);
  });
});
