export const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "completed", "reviewed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && (ASSIGNMENT_STATUSES as readonly string[]).includes(value);
}

export interface AssignmentInput {
  enrollmentId: number;
  instructorId: number;
  title: string;
  dueDate?: string | null;
  sessionId?: number | null;
}

export function validateAssignmentInput(input: Partial<AssignmentInput>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Number.isInteger(input.enrollmentId) || (input.enrollmentId ?? 0) <= 0) errors.push("enrollmentId");
  if (!Number.isInteger(input.instructorId) || (input.instructorId ?? 0) <= 0) errors.push("instructorId");
  if (typeof input.title !== "string" || !input.title.trim()) errors.push("title");
  if (input.sessionId != null && (!Number.isInteger(input.sessionId) || input.sessionId <= 0)) errors.push("sessionId");
  if (input.dueDate != null && input.dueDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) errors.push("dueDate");
  return { valid: errors.length === 0, errors };
}

const STUDENT_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  assigned: ["assigned", "in_progress", "completed"],
  in_progress: ["in_progress", "completed"],
  completed: ["completed"],
  reviewed: ["reviewed"],
};

const INSTRUCTOR_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  assigned: ["assigned", "in_progress", "completed", "reviewed"],
  in_progress: ["in_progress", "completed", "reviewed"],
  completed: ["completed", "reviewed", "in_progress"],
  reviewed: ["reviewed", "in_progress"],
};

export function canStudentTransition(from: unknown, to: unknown): boolean {
  return isAssignmentStatus(from) && isAssignmentStatus(to) && STUDENT_TRANSITIONS[from].includes(to);
}

export function canInstructorTransition(from: unknown, to: unknown): boolean {
  return isAssignmentStatus(from) && isAssignmentStatus(to) && INSTRUCTOR_TRANSITIONS[from].includes(to);
}
