export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";

export const GET: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;

  const url = new URL(request.url);
  const enrollmentId = Number(url.searchParams.get("enrollmentId"));
  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
    return json({ success: false, message: "شناسه ثبت‌نام معتبر نیست." }, 422);
  }

  const student = await db.prepare("SELECT id FROM students WHERE national_code = ?").bind(session.nationalCode).first<{ id: number }>();
  const enrollment = student
    ? await db.prepare("SELECT student_id FROM enrollments WHERE id = ?").bind(enrollmentId).first<{ student_id: number }>()
    : null;
  if (!student || !enrollment || enrollment.student_id !== student.id) {
    return json({ success: false, message: "این ثبت‌نام متعلق به شما نیست." }, 403);
  }

  const rows = await db
    .prepare(
      `SELECT id, technique_score, rhythm_score, theory_score, performance_score, discipline_score, overall_score, comment, created_at
       FROM evaluations WHERE enrollment_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .bind(enrollmentId)
    .all();

  const evaluations = (rows.results ?? []).map((row: any) => ({
    id: Number(row.id),
    technique: row.technique_score === null ? null : Number(row.technique_score),
    rhythm: row.rhythm_score === null ? null : Number(row.rhythm_score),
    theory: row.theory_score === null ? null : Number(row.theory_score),
    performance: row.performance_score === null ? null : Number(row.performance_score),
    discipline: row.discipline_score === null ? null : Number(row.discipline_score),
    overall: Number(row.overall_score),
    comment: String(row.comment || ""),
    createdAt: String(row.created_at || ""),
  }));

  return json({ success: true, evaluations });
};
