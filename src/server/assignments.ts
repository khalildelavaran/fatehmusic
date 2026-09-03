export const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "completed", "reviewed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && (ASSIGNMENT_STATUSES as readonly string[]).includes(value);
}

export interface AssignmentInput {
  enrollmentId: number;
  instructorId: number;
  sessionId?: number | null;
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Domain validation only. Database writes must additionally enforce that:
 * - the Enrollment exists and is active;
 * - the ClassSession (if provided) belongs to the Enrollment's class;
 * - the Instructor owns the class the enrollment belongs to.
 */
export function validateAssignmentInput(input: AssignmentInput): ValidationResult {
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
  if (!input.title || !input.title.trim()) {
    errors.push("عنوان تمرین الزامی است.");
  }
  if (input.dueDate !== undefined && input.dueDate !== null && input.dueDate !== "") {
    if (!DATE_PATTERN.test(input.dueDate)) {
      errors.push("مهلت انجام تمرین معتبر نیست.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Students may move an assignment forward from assigned -> in_progress -> completed.
 * Only an instructor can move a completed assignment to reviewed, or send a
 * completed/reviewed assignment back to in_progress (rejection).
 */
export function canStudentTransition(from: AssignmentStatus, to: AssignmentStatus): boolean {
  const allowed: Record<AssignmentStatus, AssignmentStatus[]> = {
    assigned: ["in_progress", "completed"],
    in_progress: ["completed"],
    completed: [],
    reviewed: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function canInstructorTransition(from: AssignmentStatus, to: AssignmentStatus): boolean {
  const allowed: Record<AssignmentStatus, AssignmentStatus[]> = {
    assigned: ["in_progress", "completed", "reviewed"],
    in_progress: ["completed", "reviewed"],
    completed: ["reviewed", "in_progress"],
    reviewed: ["in_progress"],
  };
  return allowed[from]?.includes(to) ?? false;
}
