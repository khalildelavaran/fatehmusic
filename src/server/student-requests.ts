/**
 * Student self-service requests: a new-course enrollment request, and
 * a term-renewal request for an existing class. Both are admin-
 * reviewed rather than instant self-service, consistent with the
 * project's Registration -> Approval -> Enrollment flow (CLAUDE.md)
 * and mirroring makeup-requests.ts's request/review pattern.
 */

export const REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Only admin/registrar can review; a request can only leave "pending" once. */
export function canReviewRequest(currentStatus: RequestStatus): boolean {
  return currentStatus === "pending";
}

// ---------------------------------------------------------------------
// New course requests
// ---------------------------------------------------------------------

export interface NewCourseRequestInput {
  studentId: number;
  courseId: number;
  instructorId?: number | null;
  preferredDay?: string;
  note?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateNewCourseRequestInput(input: NewCourseRequestInput): ValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(input.studentId) || input.studentId <= 0) errors.push("شناسه هنرجو معتبر نیست.");
  if (!Number.isInteger(input.courseId) || input.courseId <= 0) errors.push("دوره انتخاب‌شده معتبر نیست.");
  if (input.instructorId !== undefined && input.instructorId !== null) {
    if (!Number.isInteger(input.instructorId) || input.instructorId <= 0) errors.push("مدرس انتخاب‌شده معتبر نیست.");
  }
  return { valid: errors.length === 0, errors };
}

export interface NewCourseRequestEntry {
  id: number;
  studentId: number;
  courseId: number;
  instructorId: number | null;
  preferredDay: string;
  note: string;
  status: RequestStatus;
  reviewNote: string;
  createdAt: string;
}

function mapNewCourseRow(row: any): NewCourseRequestEntry {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    courseId: Number(row.course_id),
    instructorId: row.instructor_id === null || row.instructor_id === undefined ? null : Number(row.instructor_id),
    preferredDay: String(row.preferred_day || ""),
    note: String(row.note || ""),
    status: row.status,
    reviewNote: String(row.review_note || ""),
    createdAt: String(row.created_at || ""),
  };
}

export async function createNewCourseRequest(
  db: D1Database,
  input: NewCourseRequestInput,
): Promise<{ id: number } | { error: string }> {
  const validation = validateNewCourseRequestInput(input);
  if (!validation.valid) return { error: validation.errors.join(" ") };

  try {
    const result = await db
      .prepare(
        `INSERT INTO new_course_requests (student_id, course_id, instructor_id, preferred_day, note)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(input.studentId, input.courseId, input.instructorId ?? null, input.preferredDay ?? "", input.note ?? "")
      .run();

    const id = result.meta?.last_row_id;
    if (typeof id !== "number") return { error: "ثبت درخواست انجام نشد." };
    return { id };
  } catch (error: any) {
    if (String(error?.message || "").includes("UNIQUE")) {
      return { error: "برای این دوره پیش‌تر یک درخواست باز ثبت کرده‌اید." };
    }
    console.error("[new-course-requests] create failed", error);
    return { error: "ثبت درخواست با خطای سرور مواجه شد." };
  }
}

export async function listNewCourseRequests(
  db: D1Database,
  filters: { studentId?: number | null; status?: RequestStatus | null } = {},
): Promise<NewCourseRequestEntry[]> {
  const where: string[] = [];
  const bindings: unknown[] = [];
  if (filters.studentId) {
    where.push("student_id = ?");
    bindings.push(filters.studentId);
  }
  if (filters.status) {
    where.push("status = ?");
    bindings.push(filters.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db
    .prepare(`SELECT * FROM new_course_requests ${whereSql} ORDER BY created_at DESC, id DESC`)
    .bind(...bindings)
    .all();
  return (rows.results ?? []).map(mapNewCourseRow);
}

export async function reviewNewCourseRequest(
  db: D1Database,
  id: number,
  toStatus: "approved" | "rejected",
  reviewerId: number,
  reviewNote?: string,
): Promise<{ ok: true } | { error: string }> {
  const current = await db.prepare(`SELECT status FROM new_course_requests WHERE id = ?`).bind(id).first<{ status: RequestStatus }>();
  if (!current) return { error: "درخواستی با این شناسه یافت نشد." };
  if (!canReviewRequest(current.status)) return { error: "این درخواست قبلاً بررسی شده است." };

  await db
    .prepare(`UPDATE new_course_requests SET status = ?, reviewed_by_id = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(toStatus, reviewerId, reviewNote ?? "", id)
    .run();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Term renewal requests
// ---------------------------------------------------------------------

export interface TermRenewalRequestInput {
  enrollmentId: number;
  studentId: number;
  instructorId?: number | null;
  note?: string;
}

export function validateTermRenewalRequestInput(input: TermRenewalRequestInput): ValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(input.enrollmentId) || input.enrollmentId <= 0) errors.push("شناسه ثبت‌نام معتبر نیست.");
  if (!Number.isInteger(input.studentId) || input.studentId <= 0) errors.push("شناسه هنرجو معتبر نیست.");
  if (input.instructorId !== undefined && input.instructorId !== null) {
    if (!Number.isInteger(input.instructorId) || input.instructorId <= 0) errors.push("مدرس انتخاب‌شده معتبر نیست.");
  }
  return { valid: errors.length === 0, errors };
}

export interface TermRenewalRequestEntry {
  id: number;
  enrollmentId: number;
  studentId: number;
  instructorId: number | null;
  note: string;
  status: RequestStatus;
  reviewNote: string;
  createdAt: string;
}

function mapTermRenewalRow(row: any): TermRenewalRequestEntry {
  return {
    id: Number(row.id),
    enrollmentId: Number(row.enrollment_id),
    studentId: Number(row.student_id),
    instructorId: row.instructor_id === null || row.instructor_id === undefined ? null : Number(row.instructor_id),
    note: String(row.note || ""),
    status: row.status,
    reviewNote: String(row.review_note || ""),
    createdAt: String(row.created_at || ""),
  };
}

/** Verifies the enrollment belongs to this student before creating the request. */
export async function createTermRenewalRequest(
  db: D1Database,
  input: TermRenewalRequestInput,
): Promise<{ id: number } | { error: string }> {
  const validation = validateTermRenewalRequestInput(input);
  if (!validation.valid) return { error: validation.errors.join(" ") };

  const enrollment = await db
    .prepare("SELECT student_id FROM enrollments WHERE id = ?")
    .bind(input.enrollmentId)
    .first<{ student_id: number }>();
  if (!enrollment || enrollment.student_id !== input.studentId) {
    return { error: "این ثبت‌نام متعلق به شما نیست." };
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO term_renewal_requests (enrollment_id, student_id, instructor_id, note)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(input.enrollmentId, input.studentId, input.instructorId ?? null, input.note ?? "")
      .run();

    const id = result.meta?.last_row_id;
    if (typeof id !== "number") return { error: "ثبت درخواست انجام نشد." };
    return { id };
  } catch (error: any) {
    if (String(error?.message || "").includes("UNIQUE")) {
      return { error: "برای این ثبت‌نام پیش‌تر یک درخواست باز ثبت کرده‌اید." };
    }
    console.error("[term-renewal-requests] create failed", error);
    return { error: "ثبت درخواست با خطای سرور مواجه شد." };
  }
}

export async function listTermRenewalRequests(
  db: D1Database,
  filters: { studentId?: number | null; status?: RequestStatus | null } = {},
): Promise<TermRenewalRequestEntry[]> {
  const where: string[] = [];
  const bindings: unknown[] = [];
  if (filters.studentId) {
    where.push("student_id = ?");
    bindings.push(filters.studentId);
  }
  if (filters.status) {
    where.push("status = ?");
    bindings.push(filters.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db
    .prepare(`SELECT * FROM term_renewal_requests ${whereSql} ORDER BY created_at DESC, id DESC`)
    .bind(...bindings)
    .all();
  return (rows.results ?? []).map(mapTermRenewalRow);
}

export async function reviewTermRenewalRequest(
  db: D1Database,
  id: number,
  toStatus: "approved" | "rejected",
  reviewerId: number,
  reviewNote?: string,
): Promise<{ ok: true } | { error: string }> {
  const current = await db.prepare(`SELECT status FROM term_renewal_requests WHERE id = ?`).bind(id).first<{ status: RequestStatus }>();
  if (!current) return { error: "درخواستی با این شناسه یافت نشد." };
  if (!canReviewRequest(current.status)) return { error: "این درخواست قبلاً بررسی شده است." };

  await db
    .prepare(`UPDATE term_renewal_requests SET status = ?, reviewed_by_id = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(toStatus, reviewerId, reviewNote ?? "", id)
    .run();
  return { ok: true };
}
