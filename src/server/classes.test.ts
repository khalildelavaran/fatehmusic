import { describe, expect, it } from "vitest";
import { normalizeClassListParams, validateClassInput, isValidClassStatus } from "./classes";

describe("normalizeClassListParams", () => {
  it("applies defaults when nothing is provided", () => {
    const result = normalizeClassListParams({});
    expect(result).toEqual({ search: "", status: null, instructorId: null, page: 1, pageSize: 20, offset: 0 });
  });

  it("clamps page/pageSize the same way students/instructors lists do", () => {
    expect(normalizeClassListParams({ page: 0 }).page).toBe(1);
    expect(normalizeClassListParams({ pageSize: 0 }).pageSize).toBe(1);
    expect(normalizeClassListParams({ pageSize: 5000 }).pageSize).toBe(100);
  });

  it("only accepts a positive integer instructorId", () => {
    expect(normalizeClassListParams({ instructorId: 3 }).instructorId).toBe(3);
    expect(normalizeClassListParams({ instructorId: 0 }).instructorId).toBeNull();
    expect(normalizeClassListParams({ instructorId: -1 }).instructorId).toBeNull();
    expect(normalizeClassListParams({ instructorId: 1.5 }).instructorId).toBeNull();
  });

  it("drops an invalid status instead of passing it through to SQL", () => {
    expect(normalizeClassListParams({ status: "deleted" }).status).toBeNull();
    expect(normalizeClassListParams({ status: "completed" }).status).toBe("completed");
  });
});

describe("isValidClassStatus", () => {
  it("accepts the three known statuses and rejects anything else", () => {
    expect(isValidClassStatus("active")).toBe(true);
    expect(isValidClassStatus("completed")).toBe(true);
    expect(isValidClassStatus("cancelled")).toBe(true);
    expect(isValidClassStatus("bogus")).toBe(false);
  });
});

describe("validateClassInput", () => {
  it("requires title/course/instructor only on create", () => {
    expect(validateClassInput({}, { isCreate: true }).valid).toBe(false);
    expect(validateClassInput({ title: "گیتار پایه", courseId: 1, instructorId: 2 }, { isCreate: true }).valid).toBe(true);
    expect(validateClassInput({ room: "اتاق ۱" }, { isCreate: false }).valid).toBe(true);
  });

  it("validates class_type and status against their enums", () => {
    expect(validateClassInput({ classType: "group" }).valid).toBe(true);
    expect(validateClassInput({ classType: "bogus" }).valid).toBe(false);
    expect(validateClassInput({ status: "completed" }).valid).toBe(true);
    expect(validateClassInput({ status: "bogus" }).valid).toBe(false);
  });

  it("requires capacity to be a positive integer when provided", () => {
    expect(validateClassInput({ capacity: 5 }).valid).toBe(true);
    expect(validateClassInput({ capacity: 0 }).valid).toBe(false);
    expect(validateClassInput({ capacity: -2 }).valid).toBe(false);
    expect(validateClassInput({ capacity: 2.5 }).valid).toBe(false);
  });

  it("collects multiple errors at once", () => {
    const result = validateClassInput({ classType: "bogus", status: "bogus", capacity: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});
