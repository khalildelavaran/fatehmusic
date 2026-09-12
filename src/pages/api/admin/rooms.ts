export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listAllRooms, createRoom, updateRoom, checkRoomDeletable, deleteRoom, getRoom } from "../../../server/rooms";

// Room management is an admin-only setting (see spec section 47.3):
// registrars may read rooms (needed by the daily dashboard) but only
// admins may create/edit/delete/deactivate them.

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const rooms = await listAllRooms(env.DB);
    return json({ success: true, rooms });
  } catch (error) {
    console.error("[admin/rooms] list failed:", error);
    return json({ success: false, message: "دریافت فهرست اتاق‌ها با خطا مواجه شد." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      name?: unknown;
      capacity?: unknown;
      notes?: unknown;
    } | null;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return json({ success: false, message: "نام اتاق الزامی است." }, 422);
    if (name.length > 80) return json({ success: false, message: "نام اتاق طولانی‌تر از حد مجاز است." }, 422);

    const capacity = body?.capacity == null || body.capacity === "" ? null : Number(body.capacity);
    if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) {
      return json({ success: false, message: "ظرفیت اتاق معتبر نیست." }, 422);
    }
    const notes = typeof body?.notes === "string" ? body.notes : "";

    const room = await createRoom(env.DB, { name, capacity, notes });
    return json({ success: true, room }, 201);
  } catch (error) {
    console.error("[admin/rooms] create failed:", error);
    return json({ success: false, message: "افزودن اتاق با خطا مواجه شد." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      id?: unknown;
      name?: unknown;
      capacity?: unknown;
      notes?: unknown;
      status?: unknown;
    } | null;

    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return json({ success: false, message: "شناسه اتاق معتبر نیست." }, 422);

    const patch: { name?: string; capacity?: number | null; notes?: string | null; status?: "active" | "inactive" } = {};

    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return json({ success: false, message: "نام اتاق الزامی است." }, 422);
      if (name.length > 80) return json({ success: false, message: "نام اتاق طولانی‌تر از حد مجاز است." }, 422);
      patch.name = name;
    }
    if (body?.capacity !== undefined) {
      const capacity = body.capacity == null || body.capacity === "" ? null : Number(body.capacity);
      if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) {
        return json({ success: false, message: "ظرفیت اتاق معتبر نیست." }, 422);
      }
      patch.capacity = capacity;
    }
    if (body?.notes !== undefined) {
      patch.notes = typeof body.notes === "string" ? body.notes : "";
    }
    if (body?.status !== undefined) {
      if (body.status !== "active" && body.status !== "inactive") {
        return json({ success: false, message: "وضعیت اتاق معتبر نیست." }, 422);
      }
      patch.status = body.status;
    }

    const room = await updateRoom(env.DB, id, patch);
    if (!room) return json({ success: false, message: "اتاق موردنظر پیدا نشد." }, 404);
    return json({ success: true, room });
  } catch (error) {
    console.error("[admin/rooms] update failed:", error);
    return json({ success: false, message: "ویرایش اتاق با خطا مواجه شد." }, 500);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return json({ success: false, message: "شناسه اتاق معتبر نیست." }, 422);

    const existing = await getRoom(env.DB, id);
    if (!existing) return json({ success: false, message: "اتاق موردنظر پیدا نشد." }, 404);

    const blocked = await checkRoomDeletable(env.DB, id);
    if (blocked) return json({ success: false, message: blocked.message, reason: blocked.reason }, 409);

    const deleted = await deleteRoom(env.DB, id);
    if (!deleted) return json({ success: false, message: "حذف اتاق با خطا مواجه شد." }, 500);
    return json({ success: true, id });
  } catch (error) {
    console.error("[admin/rooms] delete failed:", error);
    return json({ success: false, message: "حذف اتاق با خطا مواجه شد." }, 500);
  }
};
