export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, json, type InstructorEnv } from "../../../server/instructor-auth";
import { validateEvaluationInput, type EvaluationInput } from "../../../server/evaluations";
import { instructorOwnsEnrollment } from "../../../server/instructor-portal";
import { recordAuditEvent } from "../../../server/audit-log";

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
      `SELECT id, enrollment_id, session_id, instructor_id, technique_score, rhythm_score,
              theory_score, performance_score, discipline_score, overall_score, comment,
              created_at, updated_at
       FROM evaluations WHERE enrollment_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .bind(enrollmentId)
    .all();

  return json({ success: true, evaluations: (rows.results ?? []).map(mapRow) });
};

export const POST: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
  const db = env.DB;

  let body: Omit<EvaluationInput, "instructorId">;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const input: EvaluationInput = { ...body, instructorId: session.instructorId };
  const validation = validateEvaluationInput(input);
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

  if (!(await instructorOwnsEnrollment(db, session.instructorId, input.enrollmentId))) {
    return json({ success: false, message: "این هنرجو متعلق به کلاس‌های شما نیست." }, 403);
  }

  if (input.sessionId) {
    const belongs = await db
      .prepare(
        `SELECT 1 FROM class_sessions cs JOIN enrollments e ON e.class_id = cs.class_id WHERE cs.id = ? AND e.id = ?`,
      )
      .bind(input.sessionId, input.enrollmentId)
      .first();
    if (!belongs) return json({ success: false, message: "جلسه انتخاب‌شده متعلق به این کلاس نیست." }, 422);
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
        input.enrollmentId,
        input.sessionId ?? null,
        input.instructorId,
        input.technique ?? null,
        input.rhythm ?? null,
        input.theory ?? null,
        input.performance ?? null,
        input.discipline ?? null,
        input.overall,
        input.comment ?? "",
      )
      .run();

    const id = result.meta?.last_row_id;
    if (typeof id !== "number") throw new Error("Failed to create evaluation");

    await recordAuditEvent(db, {
      actor: { type: "instructor", id: session.instructorId },
      action: "evaluation.create",
      entityType: "evaluation",
      entityId: id,
      metadata: { enrollmentId: input.enrollmentId, overall: input.overall },
    });

    const row = await db.prepare("SELECT * FROM evaluations WHERE id = ?").bind(id).first();
    return json({ success: true, evaluation: row ? mapRow(row) : null }, 201);
  } catch (error) {
    console.error("[instructor/evaluations] create failed", error);
    return json({ success: false, message: "ثبت ارزیابی با خطای سرور مواجه شد." }, 500);
  }
};
