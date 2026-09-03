export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import {
  validateAssignmentInput,
  isAssignmentStatus,
  canInstructorTransition,
  type AssignmentInput,
  type AssignmentStatus,
} from "../../../server/assignments";
import { recordAuditEvent } from "../../../server/audit-log";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

function mapRow(row: any) {
  return {
    id: Number(row.id),
    enrollmentId: Number(row.enrollment_id),
    sessionId: row.session_id === null ? null : Number(row.session_id),
    instructorId: Number(row.instructor_id),
    title: String(row.title || ""),
    description: String(row.description || ""),
    dueDate: row.due_date === null ? null : String(row.due_date),
    status: row.status as AssignmentStatus,
    studentComment: String(row.student_comment || ""),
    instructorComment: String(row.instructor_comment || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const enrollmentId = Number(url.searchParams.get("enrollmentId"));
  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
    return json({ success: false, message: "شناسه ثبت‌نام هنرجو معتبر نیست." }, 422);
  }

  const rows = await db
    .prepare(
      `SELECT id, enrollment_id, session_id, instructor_id, title, description, due_date,
              status, student_comment, instructor_comment, created_at, updated_at
       FROM assignments
       WHERE enrollment_id = ?
       ORDER BY created_at DESC, id DESC`,
    )
    .bind(enrollmentId)
    .all();

  const assignments = Array.isArray(rows.results) ? rows.results.map(mapRow) : [];
  return json({ success: true, assignments });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: AssignmentInput;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const validation = validateAssignmentInput(body);
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

  const enrollment = await db
    .prepare("SELECT e.id, e.class_id, e.status FROM enrollments e WHERE e.id = ?")
    .bind(body.enrollmentId)
    .first<{ id: number; class_id: number; status: string }>();
  if (!enrollment) return json({ success: false, message: "ثبت‌نامی با این شناسه یافت نشد." }, 404);
  if (enrollment.status !== "active") {
    return json({ success: false, message: "برای هنرجوی غیرفعال نمی‌توان تمرین ثبت کرد." }, 422);
  }

  if (body.sessionId) {
    const session = await db
      .prepare("SELECT id FROM class_sessions WHERE id = ? AND class_id = ?")
      .bind(body.sessionId, enrollment.class_id)
      .first();
    if (!session) return json({ success: false, message: "جلسه انتخاب‌شده متعلق به این کلاس نیست." }, 422);
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO assignments
           (enrollment_id, session_id, instructor_id, title, description, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'assigned')`,
      )
      .bind(
        body.enrollmentId,
        body.sessionId ?? null,
        body.instructorId,
        body.title.trim(),
        body.description ?? "",
        body.dueDate || null,
      )
      .run();

    const id = result.meta?.last_row_id;
    if (typeof id !== "number") throw new Error("Failed to create assignment");

    await recordAuditEvent(db, {
      actor: { type: "admin", label: "admin-api" },
      action: "assignment.create",
      entityType: "assignment",
      entityId: id,
      metadata: { enrollmentId: body.enrollmentId, instructorId: body.instructorId, title: body.title },
    });

    const row = await db.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first();
    return json({ success: true, assignment: row ? mapRow(row) : null }, 201);
  } catch (error) {
    console.error("[admin/assignments] create failed", error);
    return json({ success: false, message: "ثبت تمرین با خطای سرور مواجه شد." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { id?: number; status?: AssignmentStatus; instructorComment?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه تمرین معتبر نیست." }, 422);
  if (body.status !== undefined && !isAssignmentStatus(body.status)) {
    return json({ success: false, message: "وضعیت تمرین معتبر نیست." }, 422);
  }

  const current = await db
    .prepare("SELECT id, status FROM assignments WHERE id = ?")
    .bind(id)
    .first<{ id: number; status: AssignmentStatus }>();
  if (!current) return json({ success: false, message: "تمرینی با این شناسه یافت نشد." }, 404);

  if (body.status !== undefined && body.status !== current.status) {
    if (!canInstructorTransition(current.status, body.status)) {
      return json({ success: false, message: "این تغییر وضعیت مجاز نیست." }, 422);
    }
  }

  const setClauses: string[] = ["updated_at = datetime('now')"];
  const bindings: unknown[] = [];
  if (body.status !== undefined) {
    setClauses.push("status = ?");
    bindings.push(body.status);
  }
  if (body.instructorComment !== undefined) {
    setClauses.push("instructor_comment = ?");
    bindings.push(body.instructorComment);
  }
  bindings.push(id);

  await db.prepare(`UPDATE assignments SET ${setClauses.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await recordAuditEvent(db, {
    actor: { type: "admin", label: "admin-api" },
    action: "assignment.update",
    entityType: "assignment",
    entityId: id,
    metadata: { status: body.status ?? current.status },
  });

  const row = await db.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first();
  return json({ success: true, assignment: row ? mapRow(row) : null });
};
