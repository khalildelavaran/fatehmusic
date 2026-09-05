/**
 * Makeup session request/approval workflow
 * (SCHOOL-MANAGEMENT-IMPLEMENTATION.md section 38). Builds on top of
 * the existing makeup infrastructure: class_sessions(type='makeup',
 * original_session_id) and enrollment_sessions.makeup_for_id, both
 * validated by triggers in migration 0032. This module only manages
 * the *request* lifecycle; actually creating the makeup class_session
 * and enrollment_sessions row still goes through the existing
 * class-session/attendance services once a request is approved.
 */

export const MAKEUP_REQUEST_STATUSES = ["pending", "approved", "rejected", "scheduled", "completed"] as const;
export type MakeupRequestStatus = (typeof MAKEUP_REQUEST_STATUSES)[number];

export const MAKEUP_REQUESTER_TYPES = ["student", "instructor", "admin", "registrar"] as const;
export type MakeupRequesterType = (typeof MAKEUP_REQUESTER_TYPES)[number];

export function isMakeupRequestStatus(value: unknown): value is MakeupRequestStatus {
  return typeof value === "string" && (MAKEUP_REQUEST_STATUSES as readonly string[]).includes(value);
}
export function isMakeupRequesterType(value: unknown): value is MakeupRequesterType {
  return typeof value === "string" && (MAKEUP_REQUESTER_TYPES as readonly string[]).includes(value);
}

export interface MakeupRequestInput {
  originalEnrollmentSessionId: number;
  enrollmentId: number;
  requestedByType: MakeupRequesterType;
  requestedById?: number | null;
  reason?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateMakeupRequestInput(input: MakeupRequestInput): ValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(input.originalEnrollmentSessionId) || input.originalEnrollmentSessionId <= 0) {
    errors.push("شناسه جلسه غایب‌شده معتبر نیست.");
  }
  if (!Number.isInteger(input.enrollmentId) || input.enrollmentId <= 0) {
    errors.push("شناسه ثبت‌نام معتبر نیست.");
  }
  if (!isMakeupRequesterType(input.requestedByType)) {
    errors.push("نوع درخواست‌کننده معتبر نیست.");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Only admin/registrar can move a request forward from pending. A
 * student or instructor can only ever create a request (pending); they
 * cannot self-approve. "completed" is set by the system once the
 * linked makeup class_session itself is marked completed, not
 * directly by a reviewer -- see markMakeupRequestCompleted below.
 */
export function canReviewerTransition(from: MakeupRequestStatus, to: MakeupRequestStatus): boolean {
  const allowed: Record<MakeupRequestStatus, MakeupRequestStatus[]> = {
    pending: ["approved", "rejected"],
    approved: ["scheduled", "rejected"],
    rejected: [],
    scheduled: ["completed"],
    completed: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export interface MakeupRequestEntry {
  id: number;
  originalEnrollmentSessionId: number;
  enrollmentId: number;
  requestedByType: MakeupRequesterType;
  requestedById: number | null;
  reason: string;
  status: MakeupRequestStatus;
  reviewedById: number | null;
  reviewNote: string;
  makeupSessionId: number | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): MakeupRequestEntry {
  return {
    id: Number(row.id),
    originalEnrollmentSessionId: Number(row.original_enrollment_session_id),
    enrollmentId: Number(row.enrollment_id),
    requestedByType: row.requested_by_type,
    requestedById: row.requested_by_id === null || row.requested_by_id === undefined ? null : Number(row.requested_by_id),
    reason: String(row.reason || ""),
    status: row.status,
    reviewedById: row.reviewed_by_id === null || row.reviewed_by_id === undefined ? null : Number(row.reviewed_by_id),
    reviewNote: String(row.review_note || ""),
    makeupSessionId: row.makeup_session_id === null || row.makeup_session_id === undefined ? null : Number(row.makeup_session_id),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

const SELECT_COLUMNS = `id, original_enrollment_session_id, enrollment_id, requested_by_type, requested_by_id,
  reason, status, reviewed_by_id, review_note, makeup_session_id, created_at, updated_at`;

/**
 * Creates a request only for an absence that is (a) actually excused
 * and (b) belongs to the given enrollment. Returns an error code
 * string on failure (never throws for expected validation failures),
 * or the created row's id on success.
 */
export async function createMakeupRequest(
  db: D1Database,
  input: MakeupRequestInput,
): Promise<{ id: number } | { error: string }> {
  const validation = validateMakeupRequestInput(input);
  if (!validation.valid) return { error: validation.errors.join(" ") };

  const absence = await db
    .prepare(`SELECT id, enrollment_id, status FROM enrollment_sessions WHERE id = ?`)
    .bind(input.originalEnrollmentSessionId)
    .first<{ id: number; enrollment_id: number; status: string }>();

  if (!absence) return { error: "جلسه موردنظر یافت نشد." };
  if (absence.enrollment_id !== input.enrollmentId) return { error: "این جلسه متعلق به این ثبت‌نام نیست." };
  if (absence.status !== "excused") return { error: "فقط برای غیبت موجه می‌توان درخواست جلسه جبرانی ثبت کرد." };

  try {
    const result = await db
      .prepare(
        `INSERT INTO makeup_requests (original_enrollment_session_id, enrollment_id, requested_by_type, requested_by_id, reason)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(input.originalEnrollmentSessionId, input.enrollmentId, input.requestedByType, input.requestedById ?? null, input.reason ?? "")
      .run();

    const id = result.meta?.last_row_id;
    if (typeof id !== "number") return { error: "ثبت درخواست انجام نشد." };
    return { id };
  } catch (error: any) {
    if (String(error?.message || "").includes("UNIQUE")) {
      return { error: "برای این غیبت پیش‌تر یک درخواست باز ثبت شده است." };
    }
    console.error("[makeup-requests] create failed", error);
    return { error: "ثبت درخواست با خطای سرور مواجه شد." };
  }
}

export async function listMakeupRequests(
  db: D1Database,
  filters: { status?: MakeupRequestStatus | null; enrollmentId?: number | null } = {},
): Promise<MakeupRequestEntry[]> {
  const where: string[] = [];
  const bindings: unknown[] = [];
  if (filters.status) {
    where.push("status = ?");
    bindings.push(filters.status);
  }
  if (filters.enrollmentId) {
    where.push("enrollment_id = ?");
    bindings.push(filters.enrollmentId);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM makeup_requests ${whereSql} ORDER BY created_at DESC, id DESC`)
    .bind(...bindings)
    .all();
  return (rows.results ?? []).map(mapRow);
}

/**
 * Reviews (approves/rejects) a pending or approved request. Enforces
 * the state machine server-side via canReviewerTransition -- the
 * caller (an admin API route) must not skip this check.
 */
export async function reviewMakeupRequest(
  db: D1Database,
  id: number,
  toStatus: MakeupRequestStatus,
  reviewerId: number,
  reviewNote?: string,
): Promise<{ ok: true } | { error: string }> {
  const current = await db.prepare(`SELECT status FROM makeup_requests WHERE id = ?`).bind(id).first<{ status: MakeupRequestStatus }>();
  if (!current) return { error: "درخواستی با این شناسه یافت نشد." };
  if (!canReviewerTransition(current.status, toStatus)) return { error: "این تغییر وضعیت مجاز نیست." };

  await db
    .prepare(`UPDATE makeup_requests SET status = ?, reviewed_by_id = ?, review_note = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(toStatus, reviewerId, reviewNote ?? "", id)
    .run();
  return { ok: true };
}

/** Links an approved request to the class_session created for it, moving status to 'scheduled'. */
export async function attachMakeupSession(db: D1Database, id: number, makeupSessionId: number): Promise<{ ok: true } | { error: string }> {
  const current = await db.prepare(`SELECT status FROM makeup_requests WHERE id = ?`).bind(id).first<{ status: MakeupRequestStatus }>();
  if (!current) return { error: "درخواستی با این شناسه یافت نشد." };
  if (!canReviewerTransition(current.status, "scheduled")) return { error: "برای این درخواست هنوز نمی‌توان جلسه جبرانی تعیین کرد." };

  await db
    .prepare(`UPDATE makeup_requests SET status = 'scheduled', makeup_session_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(makeupSessionId, id)
    .run();
  return { ok: true };
}

/** Called once the linked makeup class_session itself is marked completed. */
export async function markMakeupRequestCompleted(db: D1Database, makeupSessionId: number): Promise<void> {
  await db
    .prepare(`UPDATE makeup_requests SET status = 'completed', updated_at = datetime('now') WHERE makeup_session_id = ? AND status = 'scheduled'`)
    .bind(makeupSessionId)
    .run();
}
