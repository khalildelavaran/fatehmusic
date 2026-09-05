import { describe, expect, it } from "vitest";
import {
  canReviewerTransition,
  isMakeupRequestStatus,
  isMakeupRequesterType,
  validateMakeupRequestInput,
} from "./makeup-requests";

describe("isMakeupRequestStatus / isMakeupRequesterType", () => {
  it("accepts all five canonical statuses", () => {
    for (const s of ["pending", "approved", "rejected", "scheduled", "completed"]) {
      expect(isMakeupRequestStatus(s)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isMakeupRequestStatus("done")).toBe(false);
    expect(isMakeupRequestStatus(1)).toBe(false);
  });

  it("accepts all four requester types", () => {
    for (const t of ["student", "instructor", "admin", "registrar"]) {
      expect(isMakeupRequesterType(t)).toBe(true);
    }
  });
});

describe("validateMakeupRequestInput", () => {
  const base = { originalEnrollmentSessionId: 1, enrollmentId: 2, requestedByType: "student" as const };

  it("accepts a minimal valid request", () => {
    expect(validateMakeupRequestInput(base).valid).toBe(true);
  });

  it("rejects invalid ids", () => {
    expect(validateMakeupRequestInput({ ...base, originalEnrollmentSessionId: 0 }).valid).toBe(false);
    expect(validateMakeupRequestInput({ ...base, enrollmentId: -1 }).valid).toBe(false);
  });

  it("rejects an invalid requestedByType", () => {
    expect(validateMakeupRequestInput({ ...base, requestedByType: "hacker" as any }).valid).toBe(false);
  });
});

describe("canReviewerTransition", () => {
  it("allows pending -> approved/rejected", () => {
    expect(canReviewerTransition("pending", "approved")).toBe(true);
    expect(canReviewerTransition("pending", "rejected")).toBe(true);
  });

  it("allows approved -> scheduled or rejected", () => {
    expect(canReviewerTransition("approved", "scheduled")).toBe(true);
    expect(canReviewerTransition("approved", "rejected")).toBe(true);
  });

  it("allows scheduled -> completed only", () => {
    expect(canReviewerTransition("scheduled", "completed")).toBe(true);
    expect(canReviewerTransition("scheduled", "approved")).toBe(false);
  });

  it("does not allow any transition out of rejected or completed", () => {
    expect(canReviewerTransition("rejected", "approved")).toBe(false);
    expect(canReviewerTransition("rejected", "pending")).toBe(false);
    expect(canReviewerTransition("completed", "scheduled")).toBe(false);
  });

  it("does not allow skipping straight from pending to scheduled or completed", () => {
    expect(canReviewerTransition("pending", "scheduled")).toBe(false);
    expect(canReviewerTransition("pending", "completed")).toBe(false);
  });
});
