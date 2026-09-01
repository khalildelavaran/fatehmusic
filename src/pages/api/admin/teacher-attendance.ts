export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';

async function requireAttendanceAccess(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

const VALID_STATUSES = new Set(['present', 'absent']);

export const PUT: APIRoute = async ({ request }) => {
  const denied = await requireAttendanceAccess(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);

  let body: { sessionId?: number; instructorId?: number; status?: 'present' | 'absent'; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'بدنه‌ی درخواست معتبر نیست.' }, 400);
  }

  const sessionId = Number(body.sessionId);
  const instructorId = Number(body.instructorId);
  if (!Number.isInteger(sessionId) || sessionId <= 0 || !Number.isInteger(instructorId) || instructorId <= 0) {
    return json({ success: false, message: 'شناسه جلسه یا مدرس معتبر نیست.' }, 422);
  }
  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return json({ success: false, message: 'وضعیت حضور مدرس معتبر نیست.' }, 422);
  }

  const session = await db.prepare(`
    SELECT id, instructor_id, status
    FROM class_sessions
    WHERE id = ?
  `).bind(sessionId).first<{ id: number; instructor_id: number; status: string }>();

  if (!session) return json({ success: false, message: 'جلسه یافت نشد.' }, 404);
  if (session.status === 'cancelled') {
    return json({ success: false, code: 'SESSION_CANCELLED', message: 'برای جلسه لغوشده حضور مدرس ثبت نمی‌شود.' }, 422);
  }
  if (session.instructor_id !== instructorId) {
    return json({ success: false, code: 'INSTRUCTOR_MISMATCH', message: 'این مدرس به جلسه اختصاص داده نشده است.' }, 422);
  }

  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO teacher_session_attendance
      (session_id, instructor_id, status, check_in_at, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id, instructor_id) DO UPDATE SET
      status = excluded.status,
      check_in_at = excluded.check_in_at,
      note = excluded.note,
      updated_at = excluded.updated_at
  `).bind(
    sessionId,
    instructorId,
    body.status,
    body.status === 'present' ? now : null,
    body.note ?? '',
    now,
    now,
  ).run();

  const attendance = await db.prepare(`
    SELECT id, session_id, instructor_id, status, check_in_at, note, updated_at
    FROM teacher_session_attendance
    WHERE session_id = ? AND instructor_id = ?
  `).bind(sessionId, instructorId).first();

  return json({ success: true, attendance: attendance });
};
