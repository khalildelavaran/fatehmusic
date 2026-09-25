export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { rejectIfDailyClosed } from "../../../server/daily-closure-guard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

async function splitIndividualSessions(db: D1Database, date: string): Promise<number> {
  const sessions = await db.prepare(`
    SELECT cs.id, cs.class_id, cs.session_date, cs.start_time, cs.end_time,
           cs.instructor_id, cs.room_id, cs.location_type, cs.online_platform,
           cs.meeting_url, cs.type, cs.status, cs.cancellation_reason, cs.original_session_id, cs.notes,
           c.class_type
    FROM class_sessions cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.session_date = ?
      AND cs.status <> 'cancelled'
      AND cs.type = 'regular'
      AND c.class_type NOT IN ('group', 'workshop')
    ORDER BY cs.id
  `).bind(date).all<{
    id: number; class_id: number; session_date: string; start_time: string; end_time: string;
    instructor_id: number; room_id: number | null; location_type: string; online_platform: string | null;
    meeting_url: string | null; type: string; status: string; cancellation_reason: string | null;
    original_session_id: number | null; notes: string; class_type: string;
  }>();

  let moved = 0;
  for (const session of sessions.results) {
    const rows = await db.prepare(`
      SELECT id, enrollment_id, status, attendance_mode, makeup_for_id, note, enrollment_term_id
      FROM enrollment_sessions
      WHERE session_id = ?
      ORDER BY id
    `).bind(session.id).all<{
      id: number; enrollment_id: number; status: string; attendance_mode: string | null;
      makeup_for_id: number | null; note: string; enrollment_term_id: number | null;
    }>();
    if (rows.results.length <= 1) continue;

    for (const enrollmentSession of rows.results.slice(1)) {
      const marker = `جلسه انفرادی هنرجو #${enrollmentSession.id}`;
      let target = await db.prepare(`
        SELECT id FROM class_sessions
        WHERE session_date = ? AND class_id = ? AND notes = ? AND status <> 'cancelled'
        LIMIT 1
      `).bind(date, session.class_id, marker).first<{ id: number }>();

      if (!target) {
        const insert = await db.prepare(`
          INSERT INTO class_sessions (
            class_id, session_date, start_time, end_time, instructor_id, room_id,
            location_type, online_platform, meeting_url, type, status,
            cancellation_reason, original_session_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'regular', ?, ?, ?, ?)
        `).bind(
          session.class_id, session.session_date, session.start_time, session.end_time,
          session.instructor_id, session.room_id, session.location_type, session.online_platform,
          session.meeting_url, session.status, session.cancellation_reason,
          session.id, marker,
        ).run();
        if (typeof insert.meta.last_row_id !== "number" || insert.meta.last_row_id < 1) {
          throw new Error("INDIVIDUAL_SESSION_SPLIT_FAILED");
        }
        target = { id: insert.meta.last_row_id };
      }

      const movedResult = await db.prepare(`
        UPDATE enrollment_sessions
        SET session_id = ?, updated_at = datetime('now')
        WHERE id = ? AND session_id = ?
      `).bind(target.id, enrollmentSession.id, session.id).run();
      if (movedResult.meta.changes) moved += 1;
    }
  }
  return moved;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
    const date = new URL(request.url).searchParams.get("date") || "";
    if (!DATE_RE.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);
    const closed = await rejectIfDailyClosed(env.DB, date);
    if (closed) return closed;
    const moved = await splitIndividualSessions(env.DB, date);
    return json({ success: true, date, moved });
  } catch (error) {
    console.error("[admin/daily-student-sessions] normalize failed:", error);
    return json({ success: false, message: "تفکیک جلسات هنرجویان با خطا مواجه شد." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      enrollmentSessionId?: number; sessionDate?: string; startTime?: string; endTime?: string;
      roomId?: number | null;
    } | null;
    const enrollmentSessionId = Number(body?.enrollmentSessionId);
    const sessionDate = String(body?.sessionDate || "");
    const startTime = String(body?.startTime || "");
    const endTime = String(body?.endTime || "");
    if (!Number.isInteger(enrollmentSessionId) || enrollmentSessionId < 1 || !DATE_RE.test(sessionDate) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return json({ success: false, message: "اطلاعات زمان هنرجو معتبر نیست." }, 422);
    }
    if (endTime <= startTime) return json({ success: false, message: "زمان پایان باید بعد از زمان شروع باشد." }, 422);
    const closed = await rejectIfDailyClosed(env.DB, sessionDate);
    if (closed) return closed;

    const row = await env.DB.prepare(`
      SELECT es.id AS enrollment_session_id, es.enrollment_id, cs.id AS session_id,
             cs.session_date, cs.class_id, cs.start_time, cs.end_time, cs.instructor_id,
             cs.room_id, cs.location_type, cs.online_platform, cs.meeting_url, cs.status,
             cs.cancellation_reason, cs.original_session_id, cs.notes, c.class_type
      FROM enrollment_sessions es
      JOIN class_sessions cs ON cs.id = es.session_id
      JOIN classes c ON c.id = cs.class_id
      WHERE es.id = ? LIMIT 1
    `).bind(enrollmentSessionId).first<{
      enrollment_session_id: number; enrollment_id: number; session_id: number; session_date: string;
      class_id: number; start_time: string; end_time: string; instructor_id: number; room_id: number | null;
      location_type: string; online_platform: string | null; meeting_url: string | null; status: string;
      cancellation_reason: string | null; original_session_id: number | null; notes: string; class_type: string;
    }>();
    if (!row || row.status === "cancelled" || row.session_date !== sessionDate) {
      return json({ success: false, message: "جلسه هنرجو پیدا نشد یا قابل ویرایش نیست." }, 404);
    }
    const isIndividual = !["group", "workshop"].includes(row.class_type);
    if (!isIndividual) return json({ success: false, message: "جلسه گروهی زمان مشترک دارد و زمان آن از کارت جلسه تغییر می‌کند." }, 422);
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (sm % 5 !== 0 || em % 5 !== 0) {
      return json({ success: false, message: "ساعت شروع و پایان باید در بازه‌های ۵ دقیقه‌ای ثبت شوند." }, 422);
    }
    if (eh * 60 + em - (sh * 60 + sm) !== 30) {
      return json({ success: false, message: "مدت جلسه انفرادی باید دقیقاً ۳۰ دقیقه باشد." }, 422);
    }

    // An instructor can only teach one student at a time: reject if this
    // new time window overlaps any other (non-cancelled) session for the
    // same instructor on the same day, excluding this student's own
    // current session (which this save is about to move/replace anyway).
    const conflict = await env.DB.prepare(`
      SELECT cs.id
      FROM class_sessions cs
      WHERE cs.session_date = ?
        AND cs.instructor_id = ?
        AND cs.status <> 'cancelled'
        AND cs.id <> ?
        AND cs.start_time < ?
        AND cs.end_time > ?
      LIMIT 1
    `).bind(sessionDate, row.instructor_id, row.session_id, endTime, startTime).first<{ id: number }>();
    if (conflict) {
      return json({ success: false, message: "این استاد در این بازه زمانی، جلسه دیگری دارد." }, 409);
    }

    let targetSessionId = row.session_id;
    const siblings = await env.DB.prepare(`
      SELECT id FROM enrollment_sessions WHERE session_id = ? ORDER BY id
    `).bind(row.session_id).all<{ id: number }>();
    if (siblings.results.length > 1) {
      const marker = `جلسه انفرادی هنرجو #${enrollmentSessionId}`;
      const existing = await env.DB.prepare(`
        SELECT id FROM class_sessions
        WHERE session_date = ? AND class_id = ? AND notes = ? AND status <> 'cancelled'
        LIMIT 1
      `).bind(sessionDate, row.class_id, marker).first<{ id: number }>();
      if (existing) {
        targetSessionId = existing.id;
      } else {
        const insert = await env.DB.prepare(`
          INSERT INTO class_sessions (
            class_id, session_date, start_time, end_time, instructor_id, room_id,
            location_type, online_platform, meeting_url, type, status,
            cancellation_reason, original_session_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'regular', ?, ?, ?, ?)
        `).bind(
          row.class_id, row.session_date, row.start_time, row.end_time, row.instructor_id, row.room_id,
          row.location_type, row.online_platform, row.meeting_url, row.status,
          row.cancellation_reason, row.session_id, marker,
        ).run();
        if (typeof insert.meta.last_row_id !== "number" || insert.meta.last_row_id < 1) throw new Error("INDIVIDUAL_SESSION_SPLIT_FAILED");
        targetSessionId = insert.meta.last_row_id;
      }
      await env.DB.prepare(`
        UPDATE enrollment_sessions SET session_id = ?, updated_at = datetime('now')
        WHERE id = ? AND session_id = ?
      `).bind(targetSessionId, enrollmentSessionId, row.session_id).run();
    }

    const result = await env.DB.prepare(`
      UPDATE class_sessions
      SET start_time = ?, end_time = ?, room_id = COALESCE(?, room_id), updated_at = datetime('now')
      WHERE id = ? AND session_date = ? AND status <> 'cancelled'
        AND NOT EXISTS (SELECT 1 FROM daily_closures dc WHERE dc.close_date = ?)
    `).bind(startTime, endTime, body?.roomId ?? null, targetSessionId, sessionDate, sessionDate).run();
    if (!result.meta.changes) {
      const raced = await rejectIfDailyClosed(env.DB, sessionDate);
      if (raced) return raced;
      return json({ success: false, message: "زمان جلسه دیگر قابل ویرایش نیست؛ اطلاعات روز را دوباره دریافت کنید." }, 409);
    }
    return json({ success: true, enrollmentSessionId, sessionId: targetSessionId, startTime, endTime });
  } catch (error) {
    console.error("[admin/daily-student-sessions] update failed:", error);
    return json({ success: false, message: "ذخیره زمان هنرجو با خطا مواجه شد." }, 500);
  }
};
