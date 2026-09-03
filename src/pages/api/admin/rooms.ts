export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json, requireRole, ROLES } from '../../../server/admin-auth';
import { createRoom, listRooms, updateRoom, type RoomStatus } from '../../../server/rooms';

async function access(request: Request) {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

const messages: Record<string, string> = {
  ROOM_NAME_REQUIRED: 'نام اتاق الزامی است.',
  INVALID_ROOM_CAPACITY: 'ظرفیت اتاق معتبر نیست.',
  INVALID_BRANCH: 'شناسه شعبه معتبر نیست.',
  INVALID_ROOM_STATUS: 'وضعیت اتاق معتبر نیست.',
  ROOM_ALREADY_EXISTS: 'اتاق فعالی با این نام در این شعبه وجود دارد.',
  ROOM_NOT_FOUND: 'اتاق یافت نشد.',
  ROOM_HAS_ACTIVE_SCHEDULE: 'این اتاق در برنامه هفتگی فعال استفاده می‌شود و قابل غیرفعال‌سازی نیست.',
};

function fail(error: unknown, fallback: string, status = 422) {
  const code = error instanceof Error ? error.message : fallback;
  return json({ success: false, code, message: messages[code] ?? 'عملیات اتاق با خطا مواجه شد.' }, status);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);
  const includeInactive = new URL(request.url).searchParams.get('includeInactive') === '1';
  try {
    return json({ success: true, rooms: await listRooms(db, includeInactive) });
  } catch (error) {
    return fail(error, 'ROOM_LIST_FAILED', 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);
  let body: { branchId?: number | null; name?: string; capacity?: number; notes?: string };
  try { body = await request.json(); } catch { return json({ success: false, message: 'بدنه درخواست معتبر نیست.' }, 400); }
  try {
    const room = await createRoom(db, {
      branchId: body.branchId ?? null,
      name: body.name ?? '',
      capacity: body.capacity ?? 1,
      notes: body.notes ?? '',
    });
    return json({ success: true, room }, 201);
  } catch (error) {
    return fail(error, 'ROOM_CREATE_FAILED');
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await access(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: 'دیتابیس در دسترس نیست.' }, 503);
  let body: { id?: number; branchId?: number | null; name?: string; capacity?: number; notes?: string; status?: RoomStatus };
  try { body = await request.json(); } catch { return json({ success: false, message: 'بدنه درخواست معتبر نیست.' }, 400); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: 'شناسه اتاق معتبر نیست.' }, 422);
  try {
    const room = await updateRoom(db, id, {
      branchId: body.branchId,
      name: body.name,
      capacity: body.capacity,
      notes: body.notes,
      status: body.status,
    });
    return json({ success: true, room });
  } catch (error) {
    return fail(error, 'ROOM_UPDATE_FAILED', error instanceof Error && error.message === 'ROOM_NOT_FOUND' ? 404 : 422);
  }
};
