export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import { renewEnrollmentTerm } from '../../../server/enrollment-term-service';

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);

  let body: { enrollmentId?: unknown; startDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'بدنه درخواست معتبر نیست.' }, 400);
  }

  const enrollmentId = Number(body.enrollmentId);
  const startDate = typeof body.startDate === 'string' ? body.startDate : '';
  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return json({ success: false, message: 'شناسه ثبت‌نام یا تاریخ شروع ترم معتبر نیست.' }, 422);
  }

  try {
    const result = await renewEnrollmentTerm(db, enrollmentId, startDate);
    return json({ success: true, ...result }, 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'TERM_RENEWAL_FAILED';
    const messages: Record<string, string> = {
      INVALID_ENROLLMENT: 'ثبت‌نام معتبر نیست.',
      INVALID_START_DATE: 'تاریخ شروع ترم معتبر نیست.',
      ACTIVE_ENROLLMENT_NOT_FOUND: 'ثبت‌نام فعال یافت نشد.',
      ACTIVE_TERM_NOT_FOUND: 'ترم فعال یافت نشد.',
      TERM_NOT_READY_FOR_RENEWAL: 'هنوز زمان تمدید ترم نرسیده است؛ برای ترم جلسه‌ای باید حداکثر یک جلسه باقی مانده باشد.',
      CLASS_TERM_SETTINGS_NOT_FOUND: 'تنظیمات ترم کلاس ثبت نشده است.',
      TERM_RENEWAL_CREATE_FAILED: 'ترم جدید ایجاد نشد.',
    };
    return json({ success: false, code, message: messages[code] ?? 'تمدید ترم با خطا مواجه شد.' }, 422);
  }
};
