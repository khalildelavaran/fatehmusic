export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, json, type InstructorEnv } from "../../../server/instructor-auth";
import { validateAttendance, type AttendanceStatus } from "../../../server/attendance-service";

const VALID_STATUSES = new Set<AttendanceStatus>(["pending", "present", "absent", "excused"]);

export const PUT: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);

  const db = env.DB;
  let body: { enrollmentSessionId?: number; status?: AttendanceStatus; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const id = Number(body.enrollmentSessionId);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه جلسه هنرجو معتبر نیست." }, 422);
  if (!body.status || !VALID_STATUSES.has(body.status)) return json({ success: false, message: "وضعیت حضور معتبر نیست." }, 422);

  // Server-side ownership check: an instructor may only mark attendance for
  // sessions taught by themselves (spec section 16 and 49), never trusting
  // enrollmentSessionId alone as authorization.
  const row = await db
    .prepare(
      `SELECT es.id, e.status AS enrollment_status, cs.status AS session_status, cs.instructor_id
       FROM enrollment_sessions es
       JOIN enrollments e ON e.id = es.enrollment_id
       JOIN class_sessions cs ON cs.id = es.session_id
       WHERE es.id = ?`,
    )
    .bind(id)
    .first<{ id: number; enrollment_status: string; session_status: string; instructor_id: number }>();

  if (!row) return json({ success: false, message: "جلسه هنرجو یافت نشد." }, 404);
  if (row.instructor_id !== session.instructorId) {
    return json({ success: false, message: "این جلسه متعلق به کلاس‌های شما نیست." }, 403);
  }

  try {
    validateAttendance({
      sessionExists: true,
      sessionCancelled: row.session_status === "cancelled",
      enrollmentBelongsToSession: true,
      enrollmentActive: row.enrollment_status === "active",
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATTENDANCE_INVALID";
    const message =
      code === "SESSION_CANCELLED"
        ? "برای جلسه لغوشده نمی‌توان حضور ثبت کرد."
        : code === "ENROLLMENT_INACTIVE"
          ? "ثبت‌نام هنرجو فعال نیست."
          : "ثبت حضور مجاز نیست.";
    return json({ success: false, code, message }, 422);
  }

  const updatedAt = new Date().toISOString();
  await db
    .prepare("UPDATE enrollment_sessions SET status = ?, note = ?, updated_at = ? WHERE id = ?")
    .bind(body.status, body.note ?? "", updatedAt, id)
    .run();

  const attendance = await db
    .prepare(
      "SELECT id, enrollment_id, session_id, enrollment_term_id, status, attendance_mode, makeup_for_id, note, updated_at FROM enrollment_sessions WHERE id = ?",
    )
    .bind(id)
    .first();

  return json({ success: true, attendance });
};
