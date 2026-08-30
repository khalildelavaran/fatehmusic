import { describe, expect, it } from "vitest";
import { normalizeStudentListParams, validateStudentPatch, isValidStudentStatus } from "./students";

describe("isValidStudentStatus", () => {
  it("accepts the three known statuses", () => {
    expect(isValidStudentStatus("active")).toBe(true);
    expect(isValidStudentStatus("inactive")).toBe(true);
    expect(isValidStudentStatus("graduated")).toBe(true);
  });

  it("rejects anything else, including undefined/null/numbers", () => {
    expect(isValidStudentStatus("banned")).toBe(false);
    expect(isValidStudentStatus(undefined)).toBe(false);
    expect(isValidStudentStatus(null)).toBe(false);
    expect(isValidStudentStatus(1)).toBe(false);
  });
});

describe("normalizeStudentListParams", () => {
  it("applies defaults when nothing is provided", () => {
    const result = normalizeStudentListParams({});
    expect(result).toEqual({ search: "", status: null, page: 1, pageSize: 20, offset: 0 });
  });

  it("trims search and computes offset from page/pageSize", () => {
    const result = normalizeStudentListParams({ search: "  رضا  ", page: 3, pageSize: 10 });
    expect(result.search).toBe("رضا");
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.offset).toBe(20);
  });

  it("clamps page below 1 up to 1", () => {
    expect(normalizeStudentListParams({ page: 0 }).page).toBe(1);
    expect(normalizeStudentListParams({ page: -5 }).page).toBe(1);
  });

  it("clamps pageSize to the 1..100 range", () => {
    expect(normalizeStudentListParams({ pageSize: 0 }).pageSize).toBe(1);
    expect(normalizeStudentListParams({ pageSize: 5000 }).pageSize).toBe(100);
  });

  it("drops an invalid status instead of passing it through to SQL", () => {
    expect(normalizeStudentListParams({ status: "deleted" }).status).toBeNull();
    expect(normalizeStudentListParams({ status: "active" }).status).toBe("active");
  });

  it("ignores NaN-producing input rather than propagating NaN into offset math", () => {
    const result = normalizeStudentListParams({ page: Number("not-a-number"), pageSize: Number("also-not") });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(Number.isFinite(result.offset)).toBe(true);
  });
});

describe("validateStudentPatch", () => {
  it("accepts an empty patch", () => {
    expect(validateStudentPatch({})).toEqual({ valid: true, errors: [] });
  });

  it("accepts a valid email and rejects a malformed one", () => {
    expect(validateStudentPatch({ email: "a@b.com" }).valid).toBe(true);
    expect(validateStudentPatch({ email: "not-an-email" }).valid).toBe(false);
  });

  it("treats an empty-string email as clearing the field, not an error", () => {
    expect(validateStudentPatch({ email: "" })).toEqual({ valid: true, errors: [] });
  });

  it("rejects an unknown status", () => {
    const result = validateStudentPatch({ status: "banned" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("وضعیت هنرجو معتبر نیست.");
  });

  it("accepts a plausible Jalali birth year and rejects out-of-range values", () => {
    expect(validateStudentPatch({ birthYear: 1380 }).valid).toBe(true);
    expect(validateStudentPatch({ birthYear: 1250 }).valid).toBe(false);
    expect(validateStudentPatch({ birthYear: 1600 }).valid).toBe(false);
  });

  it("treats a null birth year as clearing the field, not an error", () => {
    expect(validateStudentPatch({ birthYear: null })).toEqual({ valid: true, errors: [] });
  });

  it("collects multiple errors at once", () => {
    const result = validateStudentPatch({ email: "bad", status: "banned" });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});
