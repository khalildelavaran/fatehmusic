export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import { validateAttendance, type AttendanceStatus } from '../../../server/attendance-service';

async function requireAttendanceAccess(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

const VALID_STATUSES = new Set<AttendanceStatus>(['present', 'absent', 'excused']);

export const PUT: APIRoute = async ({ request }) => {
  const denied = await requireAttendanceAccess(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);

  let body: { enrollmentSessionId?: number; status?: AttendanceStatus; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'بدنه‌ی درخواست معتبر نیست.' }, 400);
  }

  const enrollmentSessionId = Number(body.enrollmentSessionId);
  if (!Number.isInteger(enrollmentSessionId) || enrollmentSessionId <= 0) {
    return json({ success: false, message: 'شناسه Enrollment Session معتبر نیست.' }, 422);
  }
  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return json({ success: false, message: 'وضعیت حضور معتبر نیست.' }, 422);
  }

  const row = await db.prepare(`
    SELECT es.id, es.enrollment_id, es.session_id,
           e.status AS enrollment_status,
           cs.status AS session_status
    FROM enrollment_sessions es
    JOIN enrollments e ON e.id = es.enrollment_id
    JOIN class_sessions cs ON cs.id = es.session_id
    WHERE es.id = ?
  `).bind(enrollmentSessionId).first<{
    id: number;
    enrollment_id: number;
    session_id: number;
    enrollment_status: string;
    session_status: string;
  }>();

  if (!row) return json({ success: false, message: 'رکورد حضور هنرجو یافت نشد.' }, 404);

  try {
    validateAttendance({
      sessionExists: true,
      sessionCancelled: row.session_status === 'cancelled',
      enrollmentBelongsToSession: true,
      enrollmentActive: row.enrollment_status === 'active',
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ATTENDANCE_INVALID';
    const messages: Record<string, string> = {
      SESSION_CANCELLED: 'برای جلسه لغوشده نمی‌توان حضور ثبت کرد.',
      ENROLLMENT_INACTIVE: 'ثبت‌نام هنرجو فعال نیست.',
    };
    return json({ success: false, code, message: messages[code] ?? 'ثبت حضور مجاز نیست.' }, 422);
  }

  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE enrollment_sessions
    SET attendance_status = ?, attendance_note = ?, attendance_recorded_at = ?
    WHERE id = ?
  `).bind(body.status, body.note ?? null, now, enrollmentSessionId).run();

  const updated = await db.prepare(`
    SELECT id, enrollment_id, session_id, attendance_status, attendance_note, attendance_recorded_at
    FROM enrollment_sessions
    WHERE id = ?
  `).bind(enrollmentSessionId).first();

  return json({ success: true, attendance: updated });
};
