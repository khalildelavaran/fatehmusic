export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../../server/admin-auth";
import { listActiveRooms } from "../../../../server/rooms";
import { setStudentSessionStatus } from "../../../../server/student-session-operations";
import { rejectIfDailyClosed } from "../../../../server/daily-closure-guard";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function minutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    if (url.searchParams.get("resource") !== "rooms") {
      return json({ success: false, message: "منبع درخواستی معتبر نیست." }, 400);
    }

    const rooms = await listActiveRooms(env.DB);
    return json({ success: true, rooms });
  } catch (error) {
    console.error("[admin/daily-planner] rooms failed:", error);
    return json({ success: false, message: "دریافت اتاق‌ها با خطا مواجه شد." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      sessionId?: number;
      sessionDate?: string;
      startTime?: string;
      endTime?: string;
      roomId?: number | null;
    } | null;
    const sessionId = Number(body?.sessionId);
    const sessionDate = body?.sessionDate;
    const startTime = body?.startTime;
    const endTime = body?.endTime;
    const roomIdProvided = body != null && Object.prototype.hasOwnProperty.call(body, "roomId");
    const roomId = !roomIdProvided ? undefined
      : (body.roomId == null || (body.roomId as unknown) === "" ? null : Number(body.roomId));

    if (!Number.isInteger(sessionId) || sessionId < 1 || !sessionDate || !DATE_RE.test(sessionDate) || !validTime(startTime) || !validTime(endTime)) {
      return json({ success: false, message: "اطلاعات زمان‌بندی معتبر نیست." }, 422);
    }
    if (minutes(startTime) % 5 !== 0 || minutes(endTime) % 5 !== 0) {
      return json({ success: false, message: "ساعت شروع و پایان باید در بازه‌های ۵ دقیقه‌ای ثبت شوند." }, 422);
    }
    if (minutes(endTime) <= minutes(startTime)) {
      return json({ success: false, message: "زمان پایان باید بعد از زمان شروع باشد." }, 422);
    }
    if (roomId !== null && roomId !== undefined && (!Number.isInteger(roomId) || roomId < 1)) {
      return json({ success: false, message: "شناسه اتاق معتبر نیست." }, 422);
    }

    const db = env.DB;
    const session = await db.prepare(`
      SELECT cs.id, cs.session_date, cs.status, cs.room_id, c.class_type
      FROM class_sessions cs
      JOIN classes c ON c.id = cs.class_id
      WHERE cs.id = ? LIMIT 1
    `).bind(sessionId).first<{ id: number; session_date: string; status: string; room_id: number | null; class_type: string }>();

    if (!session || session.status === "cancelled" || session.session_date !== sessionDate) {
      return json({ success: false, message: "جلسه موردنظر پیدا نشد یا قابل ویرایش نیست." }, 404);
    }

    const closed = await rejectIfDailyClosed(db, session.session_date);
    if (closed) return closed;

    const isIndividual = session.class_type !== "group" && session.class_type !== "workshop";
    if (isIndividual && minutes(endTime) - minutes(startTime) !== 30) {
      return json({ success: false, message: "مدت جلسه تکی باید دقیقاً ۳۰ دقیقه باشد." }, 422);
    }

    const nextRoomId = roomId === undefined ? session.room_id : roomId;

    if (nextRoomId !== null) {
      const room = await db.prepare(`
        SELECT id FROM rooms WHERE id = ? AND status = 'active' LIMIT 1
      `).bind(nextRoomId).first<{ id: number }>();
      if (!room) return json({ success: false, message: "اتاق انتخاب‌شده فعال نیست." }, 404);
    }

    const result = await db.prepare(`
      UPDATE class_sessions
      SET start_time = ?, end_time = ?, room_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status <> 'cancelled'
        AND NOT EXISTS (SELECT 1 FROM daily_closures dc WHERE dc.close_date = ?)
    `).bind(startTime, endTime, nextRoomId, sessionId, session.session_date).run();

    if (!result.meta.changes) {
      const racedClosed = await rejectIfDailyClosed(db, session.session_date);
      if (racedClosed) return racedClosed;
      return json({ success: false, message: "جلسه دیگر قابل ویرایش نیست؛ اطلاعات روز را دوباره دریافت کنید." }, 409);
    }

    return json({ success: true, sessionId, sessionDate, startTime, endTime, roomId: nextRoomId });
  } catch (error) {
    console.error("[admin/daily-planner] update failed:", error);
    return json({ success: false, message: "ذخیره تغییر برنامه با خطا مواجه شد." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      enrollmentSessionId?: number;
      enrollmentId?: number;
      status?: string;
      classSessionId?: number;
      teacherAttendanceStatus?: string;
    } | null;

    if (body?.classSessionId !== undefined) {
      const sessionId = Number(body.classSessionId);
      const status = String(body.teacherAttendanceStatus || "");
      if (!Number.isInteger(sessionId) || sessionId < 1) {
        return json({ success: false, message: "شناسه جلسه معتبر نیست." }, 422);
      }
      if (!["pending", "present", "absent"].includes(status)) {
        return json({ success: false, message: "وضعیت حضور مدرس معتبر نیست." }, 422);
      }
      const session = await env.DB.prepare(
        `SELECT id, instructor_id, session_date FROM class_sessions WHERE id = ? LIMIT 1`
      ).bind(sessionId).first<{ id: number; instructor_id: number; session_date: string }>();
      if (!session) return json({ success: false, message: "جلسه موردنظر پیدا نشد." }, 404);

      const closed = await rejectIfDailyClosed(env.DB, session.session_date);
      if (closed) return closed;

      await env.DB.prepare(`
        INSERT INTO teacher_session_attendance (session_id, instructor_id, status, check_in_at, updated_at)
        VALUES (?, ?, ?, CASE WHEN ? = 'present' THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id, instructor_id) DO UPDATE SET
          status = excluded.status,
          check_in_at = excluded.check_in_at,
          updated_at = CURRENT_TIMESTAMP
      `).bind(sessionId, session.instructor_id, status, status).run();

      return json({ success: true, classSessionId: sessionId, teacherAttendanceStatus: status });
    }

    const enrollmentSessionId = Number(body?.enrollmentSessionId);
    const enrollmentId = Number(body?.enrollmentId);
    const status = String(body?.status || "");

    if (!Number.isInteger(enrollmentSessionId) || enrollmentSessionId < 1) {
      return json({ success: false, message: "شناسه هنرجو معتبر نیست." }, 422);
    }

    const allowedAttendance = new Set(["pending", "present", "absent", "excused"]);
    if (status === "withdrawn") {
      if (!Number.isInteger(enrollmentId) || enrollmentId < 1) {
        return json({ success: false, message: "ثبت انصراف بدون شناسه ثبت‌نام ممکن نیست." }, 422);
      }
      const session = await env.DB.prepare(`
        SELECT cs.session_date
        FROM enrollment_sessions es
        JOIN class_sessions cs ON cs.id = es.session_id
        WHERE es.id = ? LIMIT 1
      `).bind(enrollmentSessionId).first<{ session_date: string }>();
      if (!session) return json({ success: false, message: "رکورد جلسه هنرجو پیدا نشد." }, 404);
      const closed = await rejectIfDailyClosed(env.DB, session.session_date);
      if (closed) return closed;

      const result = await env.DB.prepare(`
        UPDATE enrollments SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active'
      `).bind(enrollmentId).run();
      if (!result.meta.changes) return json({ success: false, message: "ثبت‌نام فعال هنرجو پیدا نشد." }, 404);
      return json({ success: true, enrollmentSessionId, enrollmentId, status });
    }

    if (!allowedAttendance.has(status)) {
      return json({ success: false, message: "وضعیت حضور معتبر نیست." }, 422);
    }

    const session = await env.DB.prepare(`
      SELECT cs.session_date
      FROM enrollment_sessions es
      JOIN class_sessions cs ON cs.id = es.session_id
      WHERE es.id = ? LIMIT 1
    `).bind(enrollmentSessionId).first<{ session_date: string }>();
    if (!session) return json({ success: false, message: "رکورد جلسه هنرجو پیدا نشد." }, 404);
    const closed = await rejectIfDailyClosed(env.DB, session.session_date);
    if (closed) return closed;

    if (status === "pending") {
      const result = await env.DB.prepare(`
        UPDATE enrollment_sessions SET status = ? WHERE id = ?
      `).bind(status, enrollmentSessionId).run();
      if (!result.meta.changes) return json({ success: false, message: "رکورد حضور پیدا نشد." }, 404);
    } else {
      await setStudentSessionStatus(env.DB, enrollmentSessionId, status as "present" | "absent" | "excused");
    }

    return json({ success: true, enrollmentSessionId, status });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ATTENDANCE_UPDATE_FAILED";
    const messages: Record<string, string> = {
      ENROLLMENT_SESSION_NOT_FOUND: "جلسه هنرجو یافت نشد.",
      ENROLLMENT_INACTIVE: "ثبت‌نام هنرجو فعال نیست.",
      SESSION_CANCELLED: "برای جلسه لغوشده حضور ثبت نمی‌شود.",
      EXCUSED_SESSION_HAS_MAKEUP: "برای این مرخصی جلسه جبرانی ایجاد شده است؛ وضعیت جلسه اصلی دیگر قابل تغییر نیست.",
    };
    console.error("[admin/daily-planner] attendance update failed:", code, error);
    return json({ success: false, code, message: messages[code] ?? "ذخیره وضعیت هنرجو با خطا مواجه شد." }, 422);
  }
};
