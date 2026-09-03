export const EVALUATION_CRITERIA = [
  "technique",
  "rhythm",
  "theory",
  "performance",
  "discipline",
] as const;
export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

export interface EvaluationScores {
  technique?: number | null;
  rhythm?: number | null;
  theory?: number | null;
  performance?: number | null;
  discipline?: number | null;
  overall: number;
}

export interface EvaluationInput extends EvaluationScores {
  enrollmentId: number;
  instructorId: number;
  sessionId?: number | null;
  comment?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isValidScore(value: unknown): boolean {
  return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
}

/**
 * Domain validation only. Database writes must additionally enforce that:
 * - the Enrollment exists;
 * - the ClassSession (if provided) belongs to the Enrollment's class;
 * - the Instructor owns the class the enrollment belongs to.
 */
export function validateEvaluationInput(input: EvaluationInput): ValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(input.enrollmentId) || input.enrollmentId <= 0) {
    errors.push("شناسه ثبت‌نام هنرجو معتبر نیست.");
  }
  if (!Number.isInteger(input.instructorId) || input.instructorId <= 0) {
    errors.push("شناسه مدرس معتبر نیست.");
  }
  if (input.sessionId !== undefined && input.sessionId !== null) {
    if (!Number.isInteger(input.sessionId) || input.sessionId <= 0) {
      errors.push("شناسه جلسه معتبر نیست.");
    }
  }
  if (!isValidScore(input.overall)) {
    errors.push("نمره کلی باید بین ۰ تا ۱۰۰ باشد.");
  }
  for (const criterion of EVALUATION_CRITERIA) {
    const value = input[criterion];
    if (value !== undefined && value !== null && !isValidScore(value)) {
      errors.push(`نمره ${criterion} باید بین ۰ تا ۱۰۰ باشد.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeOverallScore(scores: Omit<EvaluationScores, "overall">): number | null {
  const values = EVALUATION_CRITERIA
    .map((criterion) => scores[criterion])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round(sum / values.length);
}
