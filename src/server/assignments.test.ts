import { describe, expect, it } from "vitest";
import {
  canInstructorTransition,
  canStudentTransition,
  isAssignmentStatus,
  validateAssignmentInput,
} from "./assignments";

describe("isAssignmentStatus", () => {
  it("accepts the four canonical statuses", () => {
    expect(isAssignmentStatus("assigned")).toBe(true);
    expect(isAssignmentStatus("in_progress")).toBe(true);
    expect(isAssignmentStatus("completed")).toBe(true);
    expect(isAssignmentStatus("reviewed")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAssignmentStatus("done")).toBe(false);
    expect(isAssignmentStatus(1)).toBe(false);
    expect(isAssignmentStatus(undefined)).toBe(false);
  });
});

describe("validateAssignmentInput", () => {
  const base = { enrollmentId: 1, instructorId: 2, title: "گام سل ماژور" };

  it("accepts a minimal valid assignment", () => {
    expect(validateAssignmentInput(base).valid).toBe(true);
  });

  it("requires a non-empty title", () => {
    expect(validateAssignmentInput({ ...base, title: "" }).valid).toBe(false);
    expect(validateAssignmentInput({ ...base, title: "   " }).valid).toBe(false);
  });

  it("validates dueDate format when provided", () => {
    expect(validateAssignmentInput({ ...base, dueDate: "1404-07-01" }).valid).toBe(true);
    expect(validateAssignmentInput({ ...base, dueDate: "بعد از عید" }).valid).toBe(false);
    expect(validateAssignmentInput({ ...base, dueDate: null }).valid).toBe(true);
    expect(validateAssignmentInput({ ...base, dueDate: "" }).valid).toBe(true);
  });

  it("rejects invalid ids", () => {
    expect(validateAssignmentInput({ ...base, enrollmentId: 0 }).valid).toBe(false);
    expect(validateAssignmentInput({ ...base, instructorId: -5 }).valid).toBe(false);
    expect(validateAssignmentInput({ ...base, sessionId: 0 }).valid).toBe(false);
  });
});

describe("canStudentTransition", () => {
  it("allows forward progress but not skipping to reviewed", () => {
    expect(canStudentTransition("assigned", "in_progress")).toBe(true);
    expect(canStudentTransition("assigned", "completed")).toBe(true);
    expect(canStudentTransition("in_progress", "completed")).toBe(true);
    expect(canStudentTransition("assigned", "reviewed")).toBe(false);
    expect(canStudentTransition("completed", "reviewed")).toBe(false);
  });

  it("does not allow a student to move a reviewed assignment", () => {
    expect(canStudentTransition("reviewed", "in_progress")).toBe(false);
  });
});

describe("canInstructorTransition", () => {
  it("allows the instructor to review a completed assignment", () => {
    expect(canInstructorTransition("completed", "reviewed")).toBe(true);
  });

  it("allows the instructor to reject back to in_progress", () => {
    expect(canInstructorTransition("completed", "in_progress")).toBe(true);
    expect(canInstructorTransition("reviewed", "in_progress")).toBe(true);
  });

  it("does not allow jumping straight from assigned to reviewed without review semantics elsewhere breaking", () => {
    // Instructors may still mark straight to reviewed if they did the work assessment out of band.
    expect(canInstructorTransition("assigned", "reviewed")).toBe(true);
  });
});
