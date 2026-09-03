export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { setStudentSessionStatus } from "../../../server/student-session-operations";

type AttendanceStatus = "present" | "absent" | "excused";
const VALID_STATUSES = new Set<AttendanceStatus>(["present", "absent", "excused"]);

const ERROR_MESSAGES: Record<string, string> = {
  ENROLLMENT_SESSION_NOT_FOUND: "جلسه هنرجو یافت نشد.",
  ENROLLMENT_INACTIVE: "ثبت‌نام هنرجو فعال نیست.",
  ENROLLMENT_SESSION_CLASS_MISMATCH: "هنرجو متعلق به کلاس این جلسه نیست.",
  ENROLLMENT_TERM_REQUIRED: "چرخه آموزشی این جلسه مشخص نشده است.",
  SESSION_CANCELLED: "برای جلسه لغوشده نمی‌توان حضور ثبت کرد.",
  EXCUSED_SESSION_HAS_MAKEUP: "برای این مرخصی جلسه جبرانی ساخته شده و وضعیت جلسه اصلی قابل تغییر نیست.",
};

export const PUT: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { enrollmentSessionId?: number; status?: AttendanceStatus; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const id = Number(body.enrollmentSessionId);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ success: false, message: "شناسه جلسه هنرجو معتبر نیست." }, 422);
  }
  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return json({ success: false, message: "وضعیت حضور معتبر نیست." }, 422);
  }

  try {
    await setStudentSessionStatus(db, id, body.status, body.note);
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATTENDANCE_UPDATE_FAILED";
    return json({
      success: false,
      code,
      message: ERROR_MESSAGES[code] ?? "ثبت حضور با خطا مواجه شد.",
    }, code === "ENROLLMENT_SESSION_NOT_FOUND" ? 404 : 422);
  }

  const attendance = await db.prepare(`
    SELECT id, enrollment_id, session_id, enrollment_term_id, status,
           attendance_mode, makeup_for_id, note, updated_at
    FROM enrollment_sessions
    WHERE id = ?
  `).bind(id).first();

  return json({ success: true, attendance });
};
