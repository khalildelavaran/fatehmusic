export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getAdminSession, json, requireRole, ROLES } from "../../../../server/admin-auth";
import { recordAuditEvent } from "../../../../server/audit-log";
import { getDailyDashboard } from "../../../../server/daily-dashboard";
import { listActiveRooms } from "../../../../server/rooms";
import { buildDailyAutoPlan } from "../../../../server/daily-auto-planner";
import { rejectIfDailyClosed } from "../../../../server/daily-closure-guard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function validDirection(value: unknown): value is "forward" | "backward" {
  return value === "forward" || value === "backward";
}

function validId(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env as any, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";
    if (!DATE_RE.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

    const directionRaw = url.searchParams.get("direction") || "forward";
    const direction = validDirection(directionRaw) ? directionRaw : "forward";

    const removeRaw = url.searchParams.get("removeSessionIds") || "";
    const removeSessionIds = removeRaw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    const [sessions, rooms] = await Promise.all([
      getDailyDashboard(env.DB, date),
      listActiveRooms(env.DB),
    ]);

    const plan = await buildDailyAutoPlan(env.DB, date, sessions, rooms, { removeSessionIds, direction });
    return json({ success: true, plan });
  } catch (error) {
    console.error("[admin/daily-planner/auto] failed:", error);
    return json({ success: false, message: "ساخت چینش هوشمند روز با خطا مواجه شد." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env as any, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      date?: unknown;
      removeSessionIds?: unknown;
      changes?: unknown;
      studentChanges?: unknown;
      direction?: unknown;
    } | null;

    const date = typeof body?.date === "string" ? body.date : "";
    const direction = validDirection(body?.direction) ? body.direction : "forward";
    if (!DATE_RE.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

    const initiallyClosed = await rejectIfDailyClosed(env.DB, date);
    if (initiallyClosed) return initiallyClosed;

    const removeSessionIds = Array.isArray(body?.removeSessionIds)
      ? body.removeSessionIds.map(Number).filter((id) => validId(id))
      : [];

    const requestedChanges = Array.isArray(body?.changes) ? body.changes : [];
    const requestedStudentChanges = Array.isArray(body?.studentChanges) ? body.studentChanges : [];
    if (requestedChanges.length > 100 || requestedStudentChanges.length > 300 || removeSessionIds.length > 100) {
      return json({ success: false, message: "تعداد تغییرات بیش از حد مجاز است." }, 422);
    }

    const [sessions, rooms] = await Promise.all([
      getDailyDashboard(env.DB, date),
      listActiveRooms(env.DB),
    ]);
    const freshPlan = await buildDailyAutoPlan(env.DB, date, sessions, rooms, { removeSessionIds, direction });

    // The browser only submits a proposal. The database state is authoritative:
    // rebuild the complete plan immediately before writing anything, then require
    // the submitted plan to match it exactly. This prevents stale cascade plans
    // from partially overwriting a schedule changed by another receptionist.
    const proposed = requestedChanges.map((raw: any) => ({
      sessionId: Number(raw?.sessionId),
      startTime: raw?.to?.startTime,
      endTime: raw?.to?.endTime,
      roomId: raw?.to?.roomId == null ? null : Number(raw.to.roomId),
    }));

    const fresh = freshPlan.changes.map((change) => ({
      sessionId: change.sessionId,
      startTime: change.to.startTime,
      endTime: change.to.endTime,
      roomId: change.to.roomId,
    }));

    const proposedStudentChanges = requestedStudentChanges.map((raw: any) => ({
      enrollmentSessionId: Number(raw?.enrollmentSessionId),
      startTime: raw?.to?.startTime,
      endTime: raw?.to?.endTime,
    }));

    const freshStudentChanges = freshPlan.studentChanges.map((change) => ({
      enrollmentSessionId: change.enrollmentSessionId,
      startTime: change.to.startTime,
      endTime: change.to.endTime,
    }));

    const sortChanges = (items: typeof fresh) => [...items].sort((a, b) => a.sessionId - b.sessionId);
    const sortStudentChanges = (items: typeof freshStudentChanges) => [...items].sort((a, b) => a.enrollmentSessionId - b.enrollmentSessionId);
    const sameChanges = JSON.stringify(sortChanges(proposed)) === JSON.stringify(sortChanges(fresh));
    const sameStudentChanges = JSON.stringify(sortStudentChanges(proposedStudentChanges)) === JSON.stringify(sortStudentChanges(freshStudentChanges));
    const sameRemovals = JSON.stringify([...removeSessionIds].sort((a, b) => a - b)) === JSON.stringify([...freshPlan.removedSessionIds].filter((id) => removeSessionIds.includes(id)).sort((a, b) => a - b));

    if (!sameChanges || !sameStudentChanges || !sameRemovals) {
      return json({
        success: false,
        code: "PLAN_STALE",
        message: "برنامه در همین فاصله تغییر کرده است؛ چینش جدید را دوباره دریافت کنید.",
        plan: freshPlan,
      }, 409);
    }

    for (const change of freshPlan.changes) {
      if (!validId(change.sessionId) || !validTime(change.to.startTime) || !validTime(change.to.endTime)) {
        return json({ success: false, message: "یکی از تغییرات پیشنهادی معتبر نیست." }, 422);
      }
      if (change.to.roomId !== null && !validId(change.to.roomId)) {
        return json({ success: false, message: "اتاق یکی از تغییرات معتبر نیست." }, 422);
      }
    }

    const studentRows = await env.DB.prepare(`
      SELECT es.id, es.enrollment_id, es.session_id, es.start_time, es.end_time
      FROM enrollment_sessions es
      WHERE es.id IN (${freshPlan.studentChanges.length ? freshPlan.studentChanges.map(() => "?").join(",") : "0"})
    `).bind(...freshPlan.studentChanges.map((change) => change.enrollmentSessionId)).all<{
      id: number; enrollment_id: number; session_id: number; start_time: string | null; end_time: string | null;
    }>();

    const studentById = new Map((studentRows.results || []).map((row) => [row.id, row]));
    for (const change of freshPlan.studentChanges) {
      const current = studentById.get(change.enrollmentSessionId);
      if (!current || current.session_id !== change.sessionId) {
        return json({ success: false, code: "PLAN_STALE", message: "زمان یکی از هنرجویان دیگر قابل تغییر نیست؛ چینش را دوباره دریافت کنید." }, 409);
      }
    }

    const currentRows = await env.DB.prepare(`
      SELECT id, class_id, session_date, start_time, end_time, room_id, status
      FROM class_sessions
      WHERE session_date = ?
        AND id IN (${freshPlan.changes.length ? freshPlan.changes.map(() => "?").join(",") : "0"})
    `).bind(date, ...freshPlan.changes.map((change) => change.sessionId)).all<{
      id: number; class_id: number; session_date: string; start_time: string; end_time: string; room_id: number | null; status: string;
    }>();

    const currentById = new Map((currentRows.results || []).map((row) => [row.id, row]));
    for (const change of freshPlan.studentChanges) {
      const current = studentById.get(change.enrollmentSessionId);
      await recordAuditEvent(env.DB, {
        actor: {
          type: actor?.role === ROLES.ADMIN ? "admin" : "registrar",
          id: actor?.userId ?? null,
          label: actor?.username ?? null,
        },
        action: "reschedule_enrollment_session_auto_plan",
        entityType: "enrollment_session",
        entityId: change.enrollmentSessionId,
        metadata: {
          sessionId: change.sessionId,
          sessionDate: date,
          previous: { startTime: current?.start_time ?? null, endTime: current?.end_time ?? null },
          next: change.to,
          studentId: change.studentId,
          studentName: change.studentName,
        },
      });
    }

    for (const change of freshPlan.changes) {
      const current = currentById.get(change.sessionId);
      if (!current || current.status === "cancelled") {
        return json({ success: false, code: "PLAN_STALE", message: "یکی از جلسات دیگر قابل تغییر نیست؛ چینش را دوباره دریافت کنید." }, 409);
      }
    }

    if (freshPlan.changes.some((change) => change.to.roomId !== null) && rooms.length) {
      const activeRoomIds = new Set(rooms.map((room) => room.id));
      if (freshPlan.changes.some((change) => change.to.roomId !== null && !activeRoomIds.has(change.to.roomId))) {
        return json({ success: false, code: "PLAN_STALE", message: "یکی از اتاق‌ها دیگر فعال نیست؛ چینش را دوباره دریافت کنید." }, 409);
      }
    }

    // Re-check immediately before the mutation. The SQL predicates below also
    // make each individual write refuse a newly closed date.
    const justBeforeWrite = await rejectIfDailyClosed(env.DB, date);
    if (justBeforeWrite) return justBeforeWrite;

    const actor = await getAdminSession(request, env as any);
    const statements: D1PreparedStatement[] = [];

    for (const change of freshPlan.studentChanges) {
      statements.push(env.DB.prepare(`
        UPDATE enrollment_sessions
        SET start_time = ?, end_time = ?
        WHERE id = ?
          AND session_id = ?
          AND NOT EXISTS (SELECT 1 FROM daily_closures dc WHERE dc.close_date = ?)
      `).bind(
        change.to.startTime,
        change.to.endTime,
        change.enrollmentSessionId,
        change.sessionId,
        date,
      ));
    }

    for (const change of freshPlan.changes) {
      statements.push(env.DB.prepare(`
        UPDATE class_sessions
        SET start_time = ?, end_time = ?, room_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND session_date = ? AND status <> 'cancelled'
          AND NOT EXISTS (SELECT 1 FROM daily_closures dc WHERE dc.close_date = ?)
      `).bind(change.to.startTime, change.to.endTime, change.to.roomId, change.sessionId, date, date));
    }

    for (const sessionId of freshPlan.removedSessionIds.filter((id) => removeSessionIds.includes(id))) {
      statements.push(env.DB.prepare(`
        UPDATE class_sessions
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND session_date = ? AND status <> 'cancelled'
          AND NOT EXISTS (SELECT 1 FROM daily_closures dc WHERE dc.close_date = ?)
      `).bind(sessionId, date, date));
    }

    if (statements.length) {
      const results = await env.DB.batch(statements);
      const failed = results.some((result) => !result.meta?.changes);
      if (failed) {
        const racedClosed = await rejectIfDailyClosed(env.DB, date);
        if (racedClosed) return racedClosed;
        return json({ success: false, code: "PLAN_STALE", message: "وضعیت برنامه هنگام اعمال تغییر کرد؛ چینش را دوباره دریافت کنید." }, 409);
      }
    }

    for (const change of freshPlan.changes) {
      const current = currentById.get(change.sessionId);
      await recordAuditEvent(env.DB, {
        actor: {
          type: actor?.role === ROLES.ADMIN ? "admin" : "registrar",
          id: actor?.userId ?? null,
          label: actor?.username ?? null,
        },
        action: "reschedule_class_session_auto_plan",
        entityType: "class_session",
        entityId: change.sessionId,
        metadata: {
          classId: current?.class_id ?? null,
          sessionDate: date,
          previous: { startTime: current?.start_time ?? null, endTime: current?.end_time ?? null, roomId: current?.room_id ?? null },
          next: change.to,
          plannerReasons: change.reasons,
        },
      });
    }

    for (const sessionId of freshPlan.removedSessionIds.filter((id) => removeSessionIds.includes(id))) {
      const current = currentById.get(sessionId);
      await recordAuditEvent(env.DB, {
        actor: {
          type: actor?.role === ROLES.ADMIN ? "admin" : "registrar",
          id: actor?.userId ?? null,
          label: actor?.username ?? null,
        },
        action: "cancel_class_session_auto_plan",
        entityType: "class_session",
        entityId: sessionId,
        metadata: { classId: current?.class_id ?? null, sessionDate: date, reason: "تمام هنرجویان جلسه غایب/مرخصی بودند" },
      });
    }

    return json({
      success: true,
      message: "کل چینش پیشنهادی با موفقیت اعمال شد.",
      appliedChanges: freshPlan.changes.length,
      appliedStudentChanges: freshPlan.studentChanges.length,
      removedSessionIds: freshPlan.removedSessionIds.filter((id) => removeSessionIds.includes(id)),
    });
  } catch (error) {
    console.error("[admin/daily-planner/auto] apply failed:", error);
    return json({ success: false, message: "اعمال چینش هوشمند با خطا مواجه شد." }, 500);
  }
};
