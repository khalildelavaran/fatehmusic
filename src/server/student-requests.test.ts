import { describe, expect, it } from "vitest";
import {
  canReviewRequest,
  isRequestStatus,
  validateNewCourseRequestInput,
  validateTermRenewalRequestInput,
} from "./student-requests";

describe("isRequestStatus", () => {
  it("accepts all three canonical statuses", () => {
    expect(isRequestStatus("pending")).toBe(true);
    expect(isRequestStatus("approved")).toBe(true);
    expect(isRequestStatus("rejected")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isRequestStatus("done")).toBe(false);
    expect(isRequestStatus(1)).toBe(false);
  });
});

describe("canReviewRequest", () => {
  it("allows review only while pending", () => {
    expect(canReviewRequest("pending")).toBe(true);
    expect(canReviewRequest("approved")).toBe(false);
    expect(canReviewRequest("rejected")).toBe(false);
  });
});

describe("validateNewCourseRequestInput", () => {
  const base = { studentId: 1, courseId: 2 };

  it("accepts a minimal valid request", () => {
    expect(validateNewCourseRequestInput(base).valid).toBe(true);
  });

  it("rejects invalid studentId or courseId", () => {
    expect(validateNewCourseRequestInput({ ...base, studentId: 0 }).valid).toBe(false);
    expect(validateNewCourseRequestInput({ ...base, courseId: -1 }).valid).toBe(false);
  });

  it("allows an omitted instructorId but rejects an invalid one", () => {
    expect(validateNewCourseRequestInput({ ...base, instructorId: undefined }).valid).toBe(true);
    expect(validateNewCourseRequestInput({ ...base, instructorId: null }).valid).toBe(true);
    expect(validateNewCourseRequestInput({ ...base, instructorId: 0 }).valid).toBe(false);
  });
});

describe("validateTermRenewalRequestInput", () => {
  const base = { enrollmentId: 1, studentId: 2 };

  it("accepts a minimal valid request", () => {
    expect(validateTermRenewalRequestInput(base).valid).toBe(true);
  });

  it("rejects invalid enrollmentId or studentId", () => {
    expect(validateTermRenewalRequestInput({ ...base, enrollmentId: 0 }).valid).toBe(false);
    expect(validateTermRenewalRequestInput({ ...base, studentId: -1 }).valid).toBe(false);
  });

  it("allows an omitted instructorId but rejects an invalid one", () => {
    expect(validateTermRenewalRequestInput({ ...base, instructorId: undefined }).valid).toBe(true);
    expect(validateTermRenewalRequestInput({ ...base, instructorId: 0 }).valid).toBe(false);
  });
});
