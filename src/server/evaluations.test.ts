import { describe, expect, it } from "vitest";
import { computeOverallScore, validateEvaluationInput } from "./evaluations";

describe("validateEvaluationInput", () => {
  const base = { enrollmentId: 1, instructorId: 2, overall: 80 };

  it("accepts a minimal valid evaluation", () => {
    expect(validateEvaluationInput(base).valid).toBe(true);
  });

  it("rejects invalid enrollmentId or instructorId", () => {
    expect(validateEvaluationInput({ ...base, enrollmentId: 0 }).valid).toBe(false);
    expect(validateEvaluationInput({ ...base, instructorId: -1 }).valid).toBe(false);
  });

  it("rejects an out-of-range overall score", () => {
    expect(validateEvaluationInput({ ...base, overall: 101 }).valid).toBe(false);
    expect(validateEvaluationInput({ ...base, overall: -1 }).valid).toBe(false);
  });

  it("rejects an out-of-range criterion score but allows a missing one", () => {
    expect(validateEvaluationInput({ ...base, technique: 120 }).valid).toBe(false);
    expect(validateEvaluationInput({ ...base, technique: undefined }).valid).toBe(true);
    expect(validateEvaluationInput({ ...base, technique: null }).valid).toBe(true);
  });

  it("rejects an invalid optional sessionId", () => {
    expect(validateEvaluationInput({ ...base, sessionId: 0 }).valid).toBe(false);
    expect(validateEvaluationInput({ ...base, sessionId: 5 }).valid).toBe(true);
    expect(validateEvaluationInput({ ...base, sessionId: null }).valid).toBe(true);
  });
});

describe("computeOverallScore", () => {
  it("averages the provided criteria and rounds to the nearest integer", () => {
    expect(computeOverallScore({ technique: 80, rhythm: 90 })).toBe(85);
    expect(computeOverallScore({ technique: 80, rhythm: 81 })).toBe(81); // rounds 80.5 up
  });

  it("ignores missing criteria", () => {
    expect(computeOverallScore({ technique: 70, rhythm: null, theory: undefined })).toBe(70);
  });

  it("returns null when no criteria are provided", () => {
    expect(computeOverallScore({})).toBeNull();
  });
});
