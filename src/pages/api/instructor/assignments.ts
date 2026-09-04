export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, json, type InstructorEnv } from "../../../server/instructor-auth";
import {
  validateAssignmentInput,
  isAssignmentStatus,
  canInstructorTransition,
  type AssignmentInput,
  type AssignmentStatus,
} from "../../../server/assignments";
import { instructorOwnsEnrollment } from "../../../server/instructor-portal";
import { recordAuditEvent } from "../../../server/audit-log";

function mapRow(row: any) {
  return {
    id: Number(row.id),
    enrollmentId: Number(row.enrollment_id),
    sessionId: row.session_id === null ? null : Number(row.session_id),
    instructorId: Number(row.instructor_id),
    title: String(row.title || ""),
    description: String(row.description || ""),
    dueDate: row.due_date ?? null,
    status: row.status as AssignmentStatus,
    studentComment: String(row.student_comment || ""),
    instructorComment: String(row.instructor_comment || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
  const db = env.DB;

  const url = new URL(request.url);
  const enrollmentId = Number(url.searchParams.get("enrollmentId"));
  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
    return json({ success: false, message: "شناسه ثبت‌نام هنرجو معتبر نیست." }, 422);
  }
  if (!(await instructorOwnsEnrollment(db, session.instructorId, enrollmentId))) {
    return json({ success: false, message: "این هنرجو متعلق به کلاس‌های شما نیست." }, 403);
  }

  const rows = await db
    .prepare(
      `SELECT id, enrollment_id, session_id, instructor_id, title, description, due_date,
              status, student_comment, instructor_comment, created_at, updated_at
       FROM assignments WHERE enrollment_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .bind(enrollmentId)
    .all();

  return json({ success: true, assignments: (rows.results ?? []).map(mapRow) });
};

export const POST: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
  const db = env.DB;

  let body: Omit<AssignmentInput, "instructorId">;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const input: AssignmentInput = { ...body, instructorId: session.instructorId };
  const validation = validateAssignmentInput(input);
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

  const enrollment = await db
    .prepare("SELECT e.id, e.class_id, e.status FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE e.id = ? AND c.instructor_id = ?")
    .bind(input.enrollmentId, session.instructorId)
    .first<{ id: number; class_id: number; status: string }>();
  if (!enrollment) return json({ success: false, message: "این هنرجو متعلق به کلاس‌های شما نیست." }, 403);
  if (enrollment.status !== "active") {
    return json({ success: false, message: "برای هنرجوی غیرفعال نمی‌توان تمرین ثبت کرد." }, 422);
  }

  if (input.sessionId) {
    const belongsToClass = await db
      .prepare("SELECT id FROM class_sessions WHERE id = ? AND class_id = ?")
      .bind(input.sessionId, enrollment.class_id)
      .first();
    if (!belongsToClass) return json({ success: false, message: "جلسه انتخاب‌شده متعلق به این کلاس نیست." }, 422);
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO assignments (enrollment_id, session_id, instructor_id, title, description, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'assigned')`,
      )
      .bind(input.enrollmentId, input.sessionId ?? null, input.instructorId, input.title.trim(), input.description ?? "", input.dueDate || null)
      .run();

    const id = result.meta?.last_row_id;
    if (typeof id !== "number") throw new Error("Failed to create assignment");

    await recordAuditEvent(db, {
      actor: { type: "instructor", id: session.instructorId },
      action: "assignment.create",
      entityType: "assignment",
      entityId: id,
      metadata: { enrollmentId: input.enrollmentId, title: input.title },
    });

    const row = await db.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first();
    return json({ success: true, assignment: row ? mapRow(row) : null }, 201);
  } catch (error) {
    console.error("[instructor/assignments] create failed", error);
    return json({ success: false, message: "ثبت تمرین با خطای سرور مواجه شد." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
  const db = env.DB;

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
    .prepare("SELECT id, status, instructor_id FROM assignments WHERE id = ?")
    .bind(id)
    .first<{ id: number; status: AssignmentStatus; instructor_id: number }>();
  if (!current) return json({ success: false, message: "تمرینی با این شناسه یافت نشد." }, 404);
  if (current.instructor_id !== session.instructorId) {
    return json({ success: false, message: "این تمرین متعلق به شما نیست." }, 403);
  }

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
    actor: { type: "instructor", id: session.instructorId },
    action: "assignment.update",
    entityType: "assignment",
    entityId: id,
    metadata: { status: body.status ?? current.status },
  });

  const row = await db.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first();
  return json({ success: true, assignment: row ? mapRow(row) : null });
};
