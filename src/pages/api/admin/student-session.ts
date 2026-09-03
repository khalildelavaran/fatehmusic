export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import { setStudentSessionStatus, createStudentMakeup } from '../../../server/student-session-operations';

export const PUT: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);

  let body: { enrollmentSessionId?: number; status?: 'present'|'absent'|'excused'; note?: string|null };
  try { body = await request.json(); } catch { return json({ success:false, message:'بدنه درخواست معتبر نیست.' }, 400); }
  const id = Number(body.enrollmentSessionId);
  if (!Number.isInteger(id) || id <= 0) return json({ success:false, message:'شناسه جلسه هنرجو معتبر نیست.' }, 422);
  if (!body.status || !['present','absent','excused'].includes(body.status)) return json({ success:false, message:'وضعیت حضور معتبر نیست.' }, 422);

  try {
    await setStudentSessionStatus(db, id, body.status, body.note);
    return json({ success:true, enrollmentSessionId:id, status:body.status });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ATTENDANCE_UPDATE_FAILED';
    const messages: Record<string,string> = {
      ENROLLMENT_SESSION_NOT_FOUND:'جلسه هنرجو یافت نشد.',
      ENROLLMENT_INACTIVE:'ثبت‌نام هنرجو فعال نیست.',
      SESSION_CANCELLED:'برای جلسه لغوشده حضور ثبت نمی‌شود.',
      EXCUSED_SESSION_HAS_MAKEUP:'برای این مرخصی جلسه جبرانی ایجاد شده است؛ وضعیت جلسه اصلی دیگر قابل تغییر نیست.'
    };
    return json({ success:false, code, message:messages[code] ?? 'ثبت وضعیت حضور با خطا مواجه شد.' }, 422);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success:false, message:'دیتابیس در دسترس نیست.' }, 503);

  let body: {
    originalEnrollmentSessionId?: number; sessionDate?: string; startTime?: string; endTime?: string;
    instructorId?: number; roomId?: number|null; locationType?: 'in_person'|'online'|'hybrid';
    onlinePlatform?: string|null; meetingUrl?: string|null; notes?: string;
  };
  try { body = await request.json(); } catch { return json({ success:false, message:'بدنه درخواست معتبر نیست.' }, 400); }
  const originalId = Number(body.originalEnrollmentSessionId);
  if (!Number.isInteger(originalId) || originalId <= 0 || !body.sessionDate || !body.startTime || !body.endTime || !Number.isInteger(Number(body.instructorId))) {
    return json({ success:false, message:'اطلاعات جلسه جبرانی کامل نیست.' }, 422);
  }

  try {
    const result = await createStudentMakeup(db, originalId, {
      sessionDate: body.sessionDate, startTime: body.startTime, endTime: body.endTime,
      instructorId: Number(body.instructorId), roomId: body.roomId ?? null,
      locationType: body.locationType ?? 'in_person', onlinePlatform: body.onlinePlatform ?? null,
      meetingUrl: body.meetingUrl ?? null, notes: body.notes ?? ''
    });
    return json({ success:true, ...result }, 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MAKEUP_CREATE_FAILED';
    const messages: Record<string,string> = {
      ENROLLMENT_SESSION_NOT_FOUND:'جلسه اصلی هنرجو یافت نشد.',
      ENROLLMENT_INACTIVE:'ثبت‌نام هنرجو فعال نیست.',
      MAKEUP_REQUIRES_EXCUSED_SESSION:'برای جلسه‌ای که مرخصی نخورده است جلسه جبرانی ایجاد نمی‌شود.',
      MAKEUP_ALREADY_CREATED:'برای این جلسه قبلاً جبرانی ایجاد شده است.',
      'جلسه اصلی یافت نشد.':'جلسه اصلی یافت نشد.'
    };
    return json({ success:false, code, message:messages[code] ?? 'ایجاد جلسه جبرانی با خطا مواجه شد.' }, 422);
  }
};
