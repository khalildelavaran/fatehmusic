export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";
import { canStudentTransition, isAssignmentStatus, type AssignmentStatus } from "../../../server/assignments";
import { recordAuditEvent } from "../../../server/audit-log";

async function resolveStudentId(db: D1Database, nationalCode: string): Promise<number | null> {
  const row = await db.prepare("SELECT id FROM students WHERE national_code = ?").bind(nationalCode).first<{ id: number }>();
  return row?.id ?? null;
}

function mapRow(row: any) {
  return {
    id: Number(row.id),
    title: String(row.title || ""),
    description: String(row.description || ""),
    dueDate: row.due_date ?? null,
    status: row.status as AssignmentStatus,
    studentComment: String(row.student_comment || ""),
    instructorComment: String(row.instructor_comment || ""),
    createdAt: String(row.created_at || ""),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;
  const studentId = await resolveStudentId(db, session.nationalCode);
  if (!studentId) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  const url = new URL(request.url);
  const enrollmentId = Number(url.searchParams.get("enrollmentId"));
  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
    return json({ success: false, message: "شناسه ثبت‌نام معتبر نیست." }, 422);
  }

  const enrollment = await db.prepare("SELECT student_id FROM enrollments WHERE id = ?").bind(enrollmentId).first<{ student_id: number }>();
  if (!enrollment || enrollment.student_id !== studentId) {
    return json({ success: false, message: "این ثبت‌نام متعلق به شما نیست." }, 403);
  }

  const rows = await db
    .prepare(
      `SELECT id, title, description, due_date, status, student_comment, instructor_comment, created_at
       FROM assignments WHERE enrollment_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .bind(enrollmentId)
    .all();

  return json({ success: true, assignments: (rows.results ?? []).map(mapRow) });
};

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;
  const studentId = await resolveStudentId(db, session.nationalCode);
  if (!studentId) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  let body: { id?: number; status?: AssignmentStatus; studentComment?: string };
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
    .prepare(
      `SELECT a.id, a.status, e.student_id FROM assignments a JOIN enrollments e ON e.id = a.enrollment_id WHERE a.id = ?`,
    )
    .bind(id)
    .first<{ id: number; status: AssignmentStatus; student_id: number }>();
  if (!current) return json({ success: false, message: "تمرینی با این شناسه یافت نشد." }, 404);
  if (current.student_id !== studentId) return json({ success: false, message: "این تمرین متعلق به شما نیست." }, 403);

  if (body.status !== undefined && body.status !== current.status) {
    if (!canStudentTransition(current.status, body.status)) {
      return json({ success: false, message: "این تغییر وضعیت مجاز نیست." }, 422);
    }
  }

  const setClauses: string[] = ["updated_at = datetime('now')"];
  const bindings: unknown[] = [];
  if (body.status !== undefined) {
    setClauses.push("status = ?");
    bindings.push(body.status);
  }
  if (body.studentComment !== undefined) {
    setClauses.push("student_comment = ?");
    bindings.push(body.studentComment);
  }
  bindings.push(id);

  await db.prepare(`UPDATE assignments SET ${setClauses.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await recordAuditEvent(db, {
    actor: { type: "student", id: studentId },
    action: "assignment.update",
    entityType: "assignment",
    entityId: id,
    metadata: { status: body.status ?? current.status },
  });

  const row = await db.prepare("SELECT * FROM assignments WHERE id = ?").bind(id).first();
  return json({ success: true, assignment: row ? mapRow(row) : null });
};
