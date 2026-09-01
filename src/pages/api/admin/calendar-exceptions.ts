export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';

const VALID_TYPES = new Set(['holiday', 'school_closure', 'special']);

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success:false, message:'دیتابیس در دسترس نیست.' }, 503);
  const date = new URL(request.url).searchParams.get('date');
  const rows = date
    ? await db.prepare(`SELECT id, exception_date, type, title, description, created_at FROM calendar_exceptions WHERE exception_date = ?`).bind(date).all()
    : await db.prepare(`SELECT id, exception_date, type, title, description, created_at FROM calendar_exceptions ORDER BY exception_date DESC`).all();
  return json({ success:true, exceptions:rows.results });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success:false, message:'دیتابیس در دسترس نیست.' }, 503);
  let body: { date?:string; type?:string; title?:string; description?:string };
  try { body = await request.json(); } catch { return json({ success:false, message:'بدنه درخواست معتبر نیست.' }, 400); }
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !body.title?.trim() || !body.type || !VALID_TYPES.has(body.type)) {
    return json({ success:false, message:'تاریخ، نوع و عنوان تعطیلی الزامی و معتبر هستند.' }, 422);
  }
  try {
    const result = await db.prepare(`INSERT INTO calendar_exceptions(exception_date,type,title,description) VALUES(?,?,?,?) ON CONFLICT(exception_date) DO UPDATE SET type=excluded.type,title=excluded.title,description=excluded.description`).bind(body.date,body.type,body.title.trim(),body.description?.trim() ?? '').run();
    return json({ success:true, id:result.meta.last_row_id ?? null }, 201);
  } catch { return json({ success:false, message:'ثبت تعطیلی انجام نشد.' }, 422); }
};
