export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";
import { createMakeupRequest, listMakeupRequests } from "../../../server/makeup-requests";
import { recordAuditEvent } from "../../../server/audit-log";

async function resolveStudentId(db: D1Database, nationalCode: string): Promise<number | null> {
  const row = await db.prepare("SELECT id FROM students WHERE national_code = ?").bind(nationalCode).first<{ id: number }>();
  return row?.id ?? null;
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

  const requests = await listMakeupRequests(db, { enrollmentId });

  // Also return the student's excused absences that don't already have an
  // open (non-rejected/non-completed) makeup request, since the portal
  // needs these to let the student pick which absence to request a
  // makeup for.
  const excusedRows = await db
    .prepare(
      `SELECT es.id AS enrollment_session_id, cs.session_date, cs.start_time, c.title AS class_title
       FROM enrollment_sessions es
       JOIN class_sessions cs ON cs.id = es.session_id
       JOIN classes c ON c.id = cs.class_id
       WHERE es.enrollment_id = ? AND es.status = 'excused'
         AND NOT EXISTS (
           SELECT 1 FROM makeup_requests mr
           WHERE mr.original_enrollment_session_id = es.id AND mr.status IN ('pending', 'approved', 'scheduled')
         )
       ORDER BY cs.session_date DESC`,
    )
    .bind(enrollmentId)
    .all();

  const requestableAbsences = (excusedRows.results ?? []).map((row: any) => ({
    enrollmentSessionId: Number(row.enrollment_session_id),
    sessionDate: String(row.session_date || ""),
    startTime: String(row.start_time || ""),
    classTitle: String(row.class_title || ""),
  }));

  return json({ success: true, requests, requestableAbsences });
};

export const POST: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;
  const studentId = await resolveStudentId(db, session.nationalCode);
  if (!studentId) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  let body: { enrollmentId?: number; originalEnrollmentSessionId?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const enrollmentId = Number(body.enrollmentId);
  const enrollment = await db.prepare("SELECT student_id FROM enrollments WHERE id = ?").bind(enrollmentId).first<{ student_id: number }>();
  if (!enrollment || enrollment.student_id !== studentId) {
    return json({ success: false, message: "این ثبت‌نام متعلق به شما نیست." }, 403);
  }

  const result = await createMakeupRequest(db, {
    originalEnrollmentSessionId: Number(body.originalEnrollmentSessionId),
    enrollmentId,
    requestedByType: "student",
    requestedById: studentId,
    reason: body.reason ?? "",
  });

  if ("error" in result) return json({ success: false, message: result.error }, 422);

  await recordAuditEvent(db, {
    actor: { type: "student", id: studentId },
    action: "makeup_request.create",
    entityType: "makeup_request",
    entityId: result.id,
    metadata: { enrollmentId },
  });

  return json({ success: true, id: result.id }, 201);
};
