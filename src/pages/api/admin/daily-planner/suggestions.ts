export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getAdminSession, json, requireRole, ROLES } from "../../../../server/admin-auth";
import { recordAuditEvent } from "../../../../server/audit-log";
import { getDailyPlannerSuggestions, parsePlannerSessionId } from "../../../../server/daily-planner-suggestions";

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
    const sessionId = parsePlannerSessionId(url.searchParams.get("sessionId"));
    const limit = Number(url.searchParams.get("limit"));
    if (!sessionId) return json({ success: false, message: "شناسه جلسه معتبر نیست." }, 422);

    const result = await getDailyPlannerSuggestions(env.DB, sessionId, Number.isFinite(limit) ? limit : 8);
    return json({ success: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SESSION_NOT_FOUND") return json({ success: false, message: "جلسه موردنظر پیدا نشد." }, 404);
    if (code === "SESSION_CANCELLED") return json({ success: false, message: "جلسه لغوشده قابل جابه‌جایی نیست." }, 409);
    console.error("[admin/daily-planner/suggestions] failed:", error);
    return json({ success: false, message: "پیشنهاد زمان جایگزین با خطا مواجه شد." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      sessionId?: unknown;
      sessionDate?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      roomId?: unknown;
    } | null;

    const sessionId = parsePlannerSessionId(body?.sessionId);
    const sessionDate = typeof body?.sessionDate === "string" ? body.sessionDate : "";
    const startTime = body?.startTime;
    const endTime = body?.endTime;
    const roomId = body?.roomId == null || body?.roomId === "" ? null : Number(body.roomId);

    if (!sessionId || !DATE_RE.test(sessionDate) || !validTime(startTime) || !validTime(endTime) || (roomId !== null && (!Number.isInteger(roomId) || roomId < 1))) {
      return json({ success: false, message: "اطلاعات پیشنهاد معتبر نیست." }, 422);
    }
    if (minutes(endTime) <= minutes(startTime)) {
      return json({ success: false, message: "زمان پایان باید بعد از زمان شروع باشد." }, 422);
    }

    const current = await env.DB.prepare(`
      SELECT id, class_id, session_date, start_time, end_time, instructor_id, room_id, status
      FROM class_sessions WHERE id = ? LIMIT 1
    `).bind(sessionId).first<{
      id: number; class_id: number; session_date: string; start_time: string; end_time: string;
      instructor_id: number; room_id: number | null; status: string;
    }>();

    if (!current || current.status === "cancelled" || current.session_date !== sessionDate) {
      return json({ success: false, message: "جلسه تغییرپذیر نیست یا تاریخ آن تغییر کرده است." }, 409);
    }

    // Re-plan immediately before commit. The selected candidate must still be
    // present in the freshly calculated conflict-free set; this prevents stale
    // browser/AI suggestions from overwriting a newly occupied slot.
    const plan = await getDailyPlannerSuggestions(env.DB, sessionId, 12);
    const candidate = plan.candidates.find((item) => (
      item.startTime === startTime && item.endTime === endTime && item.roomId === roomId
    ));
    if (!candidate) {
      return json({ success: false, message: "این گزینه دیگر آزاد نیست؛ پیشنهادها را دوباره دریافت کنید." }, 409);
    }

    if (roomId !== null) {
      const room = await env.DB.prepare(`SELECT id FROM rooms WHERE id = ? AND status = 'active' LIMIT 1`).bind(roomId).first<{ id: number }>();
      if (!room) return json({ success: false, message: "اتاق انتخاب‌شده فعال نیست." }, 409);
    }

    await env.DB.prepare(`
      UPDATE class_sessions
      SET start_time = ?, end_time = ?, room_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status <> 'cancelled'
    `).bind(startTime, endTime, roomId, sessionId).run();

    const actor = await getAdminSession(request, env);
    await recordAuditEvent(env.DB, {
      actor: {
        type: actor?.role === ROLES.ADMIN ? "admin" : "registrar",
        id: actor?.userId ?? null,
        label: actor?.username ?? null,
      },
      action: "reschedule_class_session",
      entityType: "class_session",
      entityId: sessionId,
      metadata: {
        classId: current.class_id,
        sessionDate,
        previous: { startTime: current.start_time, endTime: current.end_time, roomId: current.room_id },
        next: { startTime, endTime, roomId },
        plannerReasons: candidate.reasons,
      },
    });

    return json({
      success: true,
      sessionId,
      sessionDate,
      startTime,
      endTime,
      roomId,
      message: "تغییر برنامه با موفقیت اعمال شد.",
    });
  } catch (error) {
    console.error("[admin/daily-planner/suggestions] apply failed:", error);
    return json({ success: false, message: "اعمال پیشنهاد با خطا مواجه شد." }, 500);
  }
};
