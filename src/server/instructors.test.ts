import { describe, expect, it } from "vitest";
import { normalizeInstructorListParams, validateInstructorInput } from "./instructors";

describe("normalizeInstructorListParams", () => {
  it("applies defaults when nothing is provided", () => {
    expect(normalizeInstructorListParams({})).toEqual({ search: "", isActive: null, page: 1, pageSize: 20, offset: 0 });
  });

  it("maps status=active/inactive to a boolean, anything else to null", () => {
    expect(normalizeInstructorListParams({ status: "active" }).isActive).toBe(true);
    expect(normalizeInstructorListParams({ status: "inactive" }).isActive).toBe(false);
    expect(normalizeInstructorListParams({ status: "" }).isActive).toBeNull();
    expect(normalizeInstructorListParams({ status: "bogus" }).isActive).toBeNull();
  });

  it("clamps page and pageSize the same way the students list does", () => {
    expect(normalizeInstructorListParams({ page: 0 }).page).toBe(1);
    expect(normalizeInstructorListParams({ pageSize: 0 }).pageSize).toBe(1);
    expect(normalizeInstructorListParams({ pageSize: 5000 }).pageSize).toBe(100);
  });

  it("trims search and computes offset", () => {
    const result = normalizeInstructorListParams({ search: "  گیتار  ", page: 2, pageSize: 10 });
    expect(result.search).toBe("گیتار");
    expect(result.offset).toBe(10);
  });
});

describe("validateInstructorInput", () => {
  it("requires first/last name only on create, not on update", () => {
    expect(validateInstructorInput({}, { isCreate: true }).valid).toBe(false);
    expect(validateInstructorInput({ firstName: "خلیل", lastName: "دلاوران" }, { isCreate: true }).valid).toBe(true);
    expect(validateInstructorInput({ specialty: "گیتار" }, { isCreate: false }).valid).toBe(true);
  });

  it("validates email format when provided, allows clearing it", () => {
    expect(validateInstructorInput({ email: "a@b.com" }).valid).toBe(true);
    expect(validateInstructorInput({ email: "not-an-email" }).valid).toBe(false);
    expect(validateInstructorInput({ email: "" }).valid).toBe(true);
  });

  it("rejects a non-array instruments field", () => {
    // @ts-expect-error -- intentionally wrong type to test the runtime guard
    expect(validateInstructorInput({ instruments: "guitar-course" }).valid).toBe(false);
    expect(validateInstructorInput({ instruments: ["guitar-course"] }).valid).toBe(true);
  });
});
