export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { createClass, getClassProfile, listClasses, updateClass, validateClassInput, type ClassInput } from "../../../server/classes";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

async function validateDefaultRoom(db: D1Database, defaultRoomId: number | null | undefined): Promise<Response | null> {
  if (defaultRoomId === undefined || defaultRoomId === null) return null;
  if (!Number.isInteger(defaultRoomId) || defaultRoomId <= 0) {
    return json({ success: false, message: "اتاق پیش‌فرض معتبر نیست." }, 422);
  }
  const room = await db.prepare(`SELECT id FROM rooms WHERE id = ? AND status = 'active'`).bind(defaultRoomId).first();
  if (!room) return json({ success: false, message: "اتاق پیش‌فرض انتخاب‌شده فعال نیست." }, 422);
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) return json({ success: false, message: "شناسه کلاس معتبر نیست." }, 422);
    const profile = await getClassProfile(db, numericId);
    if (!profile) return json({ success: false, message: "کلاسی با این شناسه یافت نشد." }, 404);
    return json({ success: true, profile });
  }

  const result = await listClasses(db, {
    search: url.searchParams.get("search"),
    status: url.searchParams.get("status"),
    instructorId: url.searchParams.get("instructorId") ? Number(url.searchParams.get("instructorId")) : undefined,
    page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
    pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined
  });

  return json({ success: true, ...result });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: ClassInput;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  const validation = validateClassInput(body, { isCreate: true });
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);
  const invalidRoom = await validateDefaultRoom(db, body.defaultRoomId);
  if (invalidRoom) return invalidRoom;

  let id: number;
  try {
    id = await createClass(db, body);
  } catch (err) {
    return json({ success: false, message: err instanceof Error ? err.message : "ایجاد کلاس با خطا مواجه شد." }, 422);
  }

  const profile = await getClassProfile(db, id);
  return json({ success: true, profile }, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { id?: number } & ClassInput;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  const { id, ...patch } = body;
  if (!id || !Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه کلاس معتبر نیست." }, 422);

  const validation = validateClassInput(patch, { isCreate: false });
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);
  const invalidRoom = await validateDefaultRoom(db, patch.defaultRoomId);
  if (invalidRoom) return invalidRoom;

  const ok = await updateClass(db, id, patch);
  if (!ok) return json({ success: false, message: "به‌روزرسانی کلاس با خطا مواجه شد." }, 500);

  const profile = await getClassProfile(db, id);
  if (!profile) return json({ success: false, message: "کلاسی با این شناسه یافت نشد." }, 404);
  return json({ success: true, profile });
};
