/**
 * Makeup session request/approval workflow
 * (SCHOOL-MANAGEMENT-IMPLEMENTATION.md section 38). Builds on top of
 * the existing makeup infrastructure: class_sessions(type='makeup',
 * original_session_id) and enrollment_sessions.makeup_for_id, both
 * validated by triggers in migration 0032. This module only manages the
 * *request* lifecycle; actually creating the makeup class_session
 * and enrollment_sessions row still goes through the existing
 * class-session/attendance services once a request is approved.
 */

import { rejectIfDailyClosed } from "./daily-closure-guard";

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

export async function createMakeupRequest(
  db: D1Database,
  input: MakeupRequestInput,
): Promise<{ id: number } | { error: string }> {
  const validation = validateMakeupRequestInput(input);
  if (!validation.valid) return { error: validation.errors.join(" ") };

  const absence = await db
    .prepare(`
      SELECT es.id, es.enrollment_id, es.status, cs.session_date
      FROM enrollment_sessions es
      JOIN class_sessions cs ON cs.id = es.session_id
      WHERE es.id = ?
      LIMIT 1
    `)
    .bind(input.originalEnrollmentSessionId)
    .first<{ id: number; enrollment_id: number; status: string; session_date: string }>();

  if (!absence) return { error: "جلسه موردنظر یافت نشد." };
  if (absence.enrollment_id !== input.enrollmentId) return { error: "این جلسه متعلق به این ثبت‌نام نیست." };
  if (absence.status !== "excused") return { error: "فقط برای غیبت موجه می‌توان درخواست جلسه جبرانی ثبت کرد." };

  const closed = await rejectIfDailyClosed(db, absence.session_date);
  if (closed) return { error: "این روز بسته شده است و ثبت درخواست جلسه جبرانی جدید مجاز نیست." };

  try {
    const result = await db
      .prepare(
        `INSERT INTO makeup_requests (original_enrollment_session_id, enrollment_id, requested_by_type, requested_by_id, reason)
         SELECT ?, ?, ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM daily_closures dc WHERE dc.close_date = ?
         )`,
      )
      .bind(input.originalEnrollmentSessionId, input.enrollmentId, input.requestedByType, input.requestedById ?? null, input.reason ?? "", absence.session_date)
      .run();

    if (!result.meta?.changes) {
      const racedClosed = await rejectIfDailyClosed(db, absence.session_date);
      if (racedClosed) return { error: "این روز بسته شده است و ثبت درخواست جلسه جبرانی جدید مجاز نیست." };
      return { error: "ثبت درخواست انجام نشد؛ وضعیت جلسه تغییر کرده است." };
    }

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

export async function markMakeupRequestCompleted(db: D1Database, makeupSessionId: number): Promise<void> {
  await db
    .prepare(`UPDATE makeup_requests SET status = 'completed', updated_at = datetime('now') WHERE makeup_session_id = ? AND status = 'scheduled'`)
    .bind(makeupSessionId)
    .run();
}
