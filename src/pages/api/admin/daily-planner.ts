export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listActiveRooms } from "../../../server/rooms";

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

    // Deprecated in favor of GET /api/admin/rooms (which also serves the
    // settings page). Kept for backward compatibility; no longer capped at 3
    // rooms — the daily dashboard timeline is driven by however many active
    // rooms exist (spec section 46.4).
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
    // Distinguish "roomId key absent" (keep the session's current room)
    // from "roomId explicitly sent as null/empty" (clear the room) — the
    // daily dashboard's time-only edits (panel/timeline click, not drag)
    // never include roomId, and must not silently clear the session's room.
    const roomIdProvided = body != null && Object.prototype.hasOwnProperty.call(body, "roomId");
    const roomId = !roomIdProvided ? undefined
      : (body.roomId == null || (body.roomId as unknown) === "" ? null : Number(body.roomId));

    if (!Number.isInteger(sessionId) || sessionId < 1 || !sessionDate || !DATE_RE.test(sessionDate) || !validTime(startTime) || !validTime(endTime)) {
      return json({ success: false, message: "اطلاعات زمان‌بندی معتبر نیست." }, 422);
    }
    if (minutes(endTime) <= minutes(startTime)) {
      return json({ success: false, message: "زمان پایان باید بعد از زمان شروع باشد." }, 422);
    }
    if (roomId !== null && roomId !== undefined && (!Number.isInteger(roomId) || roomId < 1)) {
      return json({ success: false, message: "شناسه اتاق معتبر نیست." }, 422);
    }

    const db = env.DB;
    const session = await db.prepare(`
      SELECT id, session_date, status, room_id FROM class_sessions WHERE id = ? LIMIT 1
    `).bind(sessionId).first<{ id: number; session_date: string; status: string; room_id: number | null }>();

    if (!session || session.status === "cancelled" || session.session_date !== sessionDate) {
      return json({ success: false, message: "جلسه موردنظر پیدا نشد یا قابل ویرایش نیست." }, 404);
    }

    // Resolve the room to persist: explicit value from the request, or the
    // session's existing room when the client didn't mention roomId at all.
    const nextRoomId = roomId === undefined ? session.room_id : roomId;

    if (nextRoomId !== null) {
      const room = await db.prepare(`
        SELECT id FROM rooms WHERE id = ? AND status = 'active' LIMIT 1
      `).bind(nextRoomId).first<{ id: number }>();
      if (!room) return json({ success: false, message: "اتاق انتخاب‌شده فعال نیست." }, 404);
    }

    // Intentionally do not reject overlapping instructor/room assignments here.
    // Fateh supports concurrent teaching: one instructor may use two rooms, and
    // some lessons allow multiple students in the same time window.
    await db.prepare(`
      UPDATE class_sessions
      SET start_time = ?, end_time = ?, room_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(startTime, endTime, nextRoomId, sessionId).run();

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

    // Teacher (instructor) attendance for a class session — separate from
    // student attendance below, and stored in teacher_session_attendance
    // rather than enrollment_sessions.
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
        `SELECT id, instructor_id FROM class_sessions WHERE id = ? LIMIT 1`
      ).bind(sessionId).first<{ id: number; instructor_id: number }>();
      if (!session) return json({ success: false, message: "جلسه موردنظر پیدا نشد." }, 404);

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

    const result = await env.DB.prepare(`
      UPDATE enrollment_sessions SET status = ? WHERE id = ?
    `).bind(status, enrollmentSessionId).run();
    if (!result.meta.changes) return json({ success: false, message: "رکورد حضور پیدا نشد." }, 404);

    return json({ success: true, enrollmentSessionId, status });
  } catch (error) {
    console.error("[admin/daily-planner] attendance update failed:", error);
    return json({ success: false, message: "ذخیره وضعیت هنرجو با خطا مواجه شد." }, 500);
  }
};
