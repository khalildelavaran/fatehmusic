export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { validateEvaluationInput, type EvaluationInput } from "../../../server/evaluations";
import { recordAuditEvent } from "../../../server/audit-log";
import { createNotification } from "../../../server/in-app-notifications";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

function mapRow(row: any) {
  return {
    id: Number(row.id),
    enrollmentId: Number(row.enrollment_id),
    sessionId: row.session_id === null ? null : Number(row.session_id),
    instructorId: Number(row.instructor_id),
    technique: row.technique_score === null ? null : Number(row.technique_score),
    rhythm: row.rhythm_score === null ? null : Number(row.rhythm_score),
    theory: row.theory_score === null ? null : Number(row.theory_score),
    performance: row.performance_score === null ? null : Number(row.performance_score),
    discipline: row.discipline_score === null ? null : Number(row.discipline_score),
    overall: Number(row.overall_score),
    comment: String(row.comment || ""),
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
      `SELECT id, enrollment_id, session_id, instructor_id, technique_score, rhythm_score,
              theory_score, performance_score, discipline_score, overall_score, comment,
              created_at, updated_at
       FROM evaluations
       WHERE enrollment_id = ?
       ORDER BY created_at DESC, id DESC`,
    )
    .bind(enrollmentId)
    .all();

  const evaluations = Array.isArray(rows.results) ? rows.results.map(mapRow) : [];
  return json({ success: true, evaluations });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: EvaluationInput;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const validation = validateEvaluationInput(body);
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

  const enrollment = await db
    .prepare("SELECT e.id, e.class_id, e.student_id FROM enrollments e WHERE e.id = ?")
    .bind(body.enrollmentId)
    .first<{ id: number; class_id: number; student_id: number }>();
  if (!enrollment) return json({ success: false, message: "ثبت‌نامی با این شناسه یافت نشد." }, 404);

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
        `INSERT INTO evaluations
           (enrollment_id, session_id, instructor_id, technique_score, rhythm_score,
            theory_score, performance_score, discipline_score, overall_score, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        body.enrollmentId,
        body.sessionId ?? null,
        body.instructorId,
        body.technique ?? null,
        body.rhythm ?? null,
        body.theory ?? null,
        body.performance ?? null,
        body.discipline ?? null,
        body.overall,
        body.comment ?? "",
      )
      .run();

    const id = result.meta?.last_row_id;
    if (typeof id !== "number") throw new Error("Failed to create evaluation");

    await recordAuditEvent(db, {
      actor: { type: "admin", label: "admin-api" },
      action: "evaluation.create",
      entityType: "evaluation",
      entityId: id,
      metadata: { enrollmentId: body.enrollmentId, instructorId: body.instructorId, overall: body.overall },
    });

    await createNotification(db, {
      recipientType: "student",
      recipientId: enrollment.student_id,
      type: "evaluation",
      title: "ارزیابی جدید ثبت شد",
      body: `نمره کلی ارزیابی جدید شما: ${body.overall}`,
      entityType: "evaluation",
      entityId: id,
    });

    const row = await db.prepare("SELECT * FROM evaluations WHERE id = ?").bind(id).first();
    return json({ success: true, evaluation: row ? mapRow(row) : null }, 201);
  } catch (error) {
    console.error("[admin/evaluations] create failed", error);
    return json({ success: false, message: "ثبت ارزیابی با خطای سرور مواجه شد." }, 500);
  }
};
