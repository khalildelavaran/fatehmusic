export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import { renewEnrollmentTerm } from '../../../server/enrollment-term-service';

const messages: Record<string, string> = {
  INVALID_ENROLLMENT: 'ثبت‌نام هنرجو معتبر نیست.',
  INVALID_START_DATE: 'تاریخ شروع ترم جدید معتبر نیست.',
  ACTIVE_ENROLLMENT_NOT_FOUND: 'ثبت‌نام فعال هنرجو یافت نشد.',
  ACTIVE_TERM_NOT_FOUND: 'ترم فعال هنرجو یافت نشد.',
  RENEWAL_DATE_BEFORE_ACTIVE_TERM: 'تاریخ ترم جدید نمی‌تواند قبل از ترم فعلی باشد.',
  ACTIVE_TERM_PLAN_MISSING: 'تعداد جلسات ترم فعلی مشخص نیست.',
  TERM_NOT_EXHAUSTED: 'ترم فعلی هنوز جلسه مصرف‌نشده دارد.',
  MONTHLY_TERM_NOT_READY: 'چرخه ماهانه فعلی هنوز به ماه بعد نرسیده است.',
  SESSION_BASED_REQUIRES_PLANNED_SESSIONS: 'برای ترم جلسه‌ای باید تعداد جلسات کلاس تنظیم شود.',
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success:false, message:'دیتابیس در دسترس نیست.' }, 503);

  const body = await request.json().catch(() => null) as { enrollmentId?: unknown; startDate?: unknown } | null;
  const enrollmentId = Number(body?.enrollmentId);
  const startDate = typeof body?.startDate === 'string' ? body.startDate : '';

  try {
    const result = await renewEnrollmentTerm(db, enrollmentId, startDate);
    return json({ success:true, ...result }, 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'TERM_RENEW_FAILED';
    return json({ success:false, code, message:messages[code] ?? 'تمدید ترم با خطا مواجه شد.' }, 422);
  }
};
