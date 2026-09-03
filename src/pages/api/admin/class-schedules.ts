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

  const classRow = await db.prepare(`
    SELECT id, title, instructor_id, default_room_id
    FROM classes
    WHERE id = ? AND status = 'active'
  `).bind(input.classId).first<{ id:number; title:string; instructor_id:number; default_room_id:number|null }>();
  if (!classRow) return json({ success: false, message: 'کلاس فعال یافت نشد.' }, 404);

  const effectiveRoomId = input.roomId ?? classRow.default_room_id;
  if (effectiveRoomId != null) {
    const room = await db.prepare(`SELECT id FROM rooms WHERE id = ? AND status = 'active'`).bind(effectiveRoomId).first();
    if (!room) return json({ success: false, code: 'ROOM_NOT_ACTIVE', message: 'اتاق انتخاب‌شده یا اتاق پیش‌فرض کلاس فعال نیست.' }, 422);
  }

  const overlapSql = `
    schedule.status = 'active'
    AND schedule.day_of_week = ?
    AND schedule.start_time < ?
    AND schedule.end_time > ?
    AND (schedule.effective_to IS NULL OR ? IS NULL OR schedule.effective_to >= ?)
    AND (? IS NULL OR schedule.effective_from IS NULL OR schedule.effective_from <= ?)
  `;
  const overlapBindings = [
    input.dayOfWeek,
    input.endTime,
    input.startTime,
    input.effectiveFrom,
    input.effectiveFrom,
    input.effectiveTo,
    input.effectiveTo,
  ];

  if (effectiveRoomId != null) {
    const roomConflict = await db.prepare(`
      SELECT schedule.id, c.title AS class_title
      FROM class_schedules schedule
      JOIN classes c ON c.id = schedule.class_id
      WHERE ${overlapSql}
        AND COALESCE(schedule.room_id, c.default_room_id) = ?
      LIMIT 1
    `).bind(...overlapBindings, effectiveRoomId).first<{ id:number; class_title:string }>();
    if (roomConflict) {
      return json({ success: false, code: 'ROOM_SCHEDULE_CONFLICT', message: `این اتاق در همین بازه برای «${roomConflict.class_title}» رزرو است.` }, 409);
    }
  }

  const instructorConflict = await db.prepare(`
    SELECT schedule.id, c.title AS class_title
    FROM class_schedules schedule
    JOIN classes c ON c.id = schedule.class_id
    WHERE ${overlapSql}
      AND c.instructor_id = ?
    LIMIT 1
  `).bind(...overlapBindings, classRow.instructor_id).first<{ id:number; class_title:string }>();
  if (instructorConflict) {
    return json({ success: false, code: 'INSTRUCTOR_SCHEDULE_CONFLICT', message: `مدرس در همین بازه برای «${instructorConflict.class_title}» برنامه فعال دارد.` }, 409);
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
