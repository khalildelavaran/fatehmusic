export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function minutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

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
    } | null;

    const sessionId = Number(body?.sessionId);
    const sessionDate = body?.sessionDate;
    const startTime = body?.startTime;
    const endTime = body?.endTime;

    if (!Number.isInteger(sessionId) || sessionId < 1 || !sessionDate || !DATE_RE.test(sessionDate) || !validTime(startTime) || !validTime(endTime)) {
      return json({ success: false, message: "اطلاعات زمان‌بندی معتبر نیست." }, 422);
    }
    if (minutes(endTime) <= minutes(startTime)) {
      return json({ success: false, message: "زمان پایان باید بعد از زمان شروع باشد." }, 422);
    }

    const db = env.DB;
    const session = await db.prepare(`
      SELECT id, class_id, session_date, instructor_id, room_id, status
      FROM class_sessions WHERE id = ? LIMIT 1
    `).bind(sessionId).first<{
      id: number; class_id: number; session_date: string; instructor_id: number; room_id: number | null; status: string;
    }>();

    if (!session || session.status === "cancelled" || session.session_date !== sessionDate) {
      return json({ success: false, message: "جلسه موردنظر پیدا نشد یا قابل ویرایش نیست." }, 404);
    }

    const conflict = await db.prepare(`
      SELECT cs.id, cs.start_time, cs.end_time,
        c.title AS class_title,
        CASE WHEN cs.instructor_id = ? THEN 'instructor' ELSE 'room' END AS conflict_type
      FROM class_sessions cs
      JOIN classes c ON c.id = cs.class_id
      WHERE cs.id <> ?
        AND cs.session_date = ?
        AND cs.status <> 'cancelled'
        AND (cs.instructor_id = ? OR (? IS NOT NULL AND cs.room_id = ?))
        AND cs.start_time < ?
        AND cs.end_time > ?
      ORDER BY cs.start_time
      LIMIT 1
    `).bind(
      session.instructor_id, sessionId, sessionDate, session.instructor_id,
      session.room_id, session.room_id, endTime, startTime,
    ).first<{ id: number; start_time: string; end_time: string; class_title: string; conflict_type: string }>();

    if (conflict) {
      const who = conflict.conflict_type === "instructor" ? "استاد" : "اتاق";
      return json({
        success: false,
        conflict: true,
        message: `تداخل زمانی با ${who} وجود دارد: ${conflict.start_time} تا ${conflict.end_time}`,
        conflictingSession: conflict,
      }, 409);
    }

    await db.prepare(`
      UPDATE class_sessions
      SET start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(startTime, endTime, sessionId).run();

    return json({ success: true, sessionId, sessionDate, startTime, endTime });
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
    } | null;
    const enrollmentSessionId = Number(body?.enrollmentSessionId);
    const enrollmentId = Number(body?.enrollmentId);
    const status = body?.status;
    const allowed = new Set(["pending", "present", "absent", "excused"]);

    if (!Number.isInteger(enrollmentSessionId) || enrollmentSessionId < 1 || !allowed.has(String(status))) {
      return json({ success: false, message: "وضعیت حضور معتبر نیست." }, 422);
    }

    const result = await env.DB.prepare(`
      UPDATE enrollment_sessions SET status = ? WHERE id = ?
    `).bind(status, enrollmentSessionId).run();

    if (!result.meta.changes) return json({ success: false, message: "رکورد حضور پیدا نشد." }, 404);

    if (String(status) === "withdrawn" && Number.isInteger(enrollmentId) && enrollmentId > 0) {
      await env.DB.prepare(`UPDATE enrollments SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(enrollmentId).run();
    }

    return json({ success: true, enrollmentSessionId, status });
  } catch (error) {
    console.error("[admin/daily-planner] attendance update failed:", error);
    return json({ success: false, message: "ذخیره وضعیت هنرجو با خطا مواجه شد." }, 500);
  }
};
