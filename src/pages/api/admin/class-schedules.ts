export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import {
  createClassSchedule,
  deactivateClassSchedule,
  listClassSchedules,
  validateClassSchedule,
  type ClassScheduleInput,
} from '../../../server/class-schedules';

async function access(request: Request) {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);
  const classId = Number(new URL(request.url).searchParams.get('classId'));
  if (!Number.isInteger(classId) || classId <= 0) return json({ success: false, message: 'شناسه کلاس معتبر نیست.' }, 422);
  try {
    return json({ success: true, schedules: await listClassSchedules(db, classId) });
  } catch {
    return json({ success: false, message: 'دریافت برنامه هفتگی با خطا مواجه شد.' }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);

  let body: Partial<ClassScheduleInput>;
  try { body = await request.json(); } catch { return json({ success: false, message: 'بدنه درخواست معتبر نیست.' }, 400); }

  const input: ClassScheduleInput = {
    classId: Number(body.classId),
    dayOfWeek: Number(body.dayOfWeek),
    startTime: String(body.startTime ?? ''),
    endTime: String(body.endTime ?? ''),
    roomId: body.roomId == null ? null : Number(body.roomId),
    effectiveFrom: body.effectiveFrom ?? null,
    effectiveTo: body.effectiveTo ?? null,
  };
  const errors = validateClassSchedule(input);
  if (errors.length) return json({ success: false, message: errors.join(' ') }, 422);

  if (input.roomId != null) {
    const room = await db.prepare(`SELECT id FROM rooms WHERE id = ? AND status = 'active'`).bind(input.roomId).first();
    if (!room) return json({ success: false, code: 'ROOM_NOT_ACTIVE', message: 'اتاق انتخاب‌شده فعال نیست.' }, 422);
  }

  const conflict = await db.prepare(`
    SELECT cs.id, c.title AS class_title
    FROM class_schedules cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.status = 'active'
      AND cs.day_of_week = ?
      AND cs.start_time < ?
      AND cs.end_time > ?
      AND (? IS NOT NULL AND cs.room_id = ?)
      AND (cs.effective_to IS NULL OR ? IS NULL OR cs.effective_to >= ?)
      AND (? IS NULL OR cs.effective_from IS NULL OR cs.effective_from <= ?)
    LIMIT 1
  `).bind(
    input.dayOfWeek,
    input.endTime,
    input.startTime,
    input.roomId,
    input.roomId,
    input.effectiveFrom,
    input.effectiveFrom,
    input.effectiveTo,
    input.effectiveTo,
  ).first<{ id: number; class_title: string }>();
  if (conflict) {
    return json({ success: false, code: 'ROOM_SCHEDULE_CONFLICT', message: `این اتاق در همین بازه برای «${conflict.class_title}» رزرو است.` }, 409);
  }

  try {
    const id = await createClassSchedule(db, input);
    const schedules = await listClassSchedules(db, input.classId);
    return json({ success: true, schedule: schedules.find((row) => row.id === id) ?? null }, 201);
  } catch (error) {
    return json({ success: false, message: error instanceof Error ? error.message : 'ثبت برنامه هفتگی ناموفق بود.' }, 422);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);

  let body: { id?: number; action?: 'deactivate' };
  try { body = await request.json(); } catch { return json({ success: false, message: 'بدنه درخواست معتبر نیست.' }, 400); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: 'شناسه برنامه معتبر نیست.' }, 422);
  if (body.action !== 'deactivate') return json({ success: false, message: 'عملیات برنامه معتبر نیست.' }, 422);

  const exists = await db.prepare(`SELECT id FROM class_schedules WHERE id = ?`).bind(id).first();
  if (!exists) return json({ success: false, message: 'برنامه هفتگی یافت نشد.' }, 404);

  const success = await deactivateClassSchedule(db, id);
  return json({ success });
};
