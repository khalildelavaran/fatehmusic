export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireAdminSession } from "../../../server/admin-auth";

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdminSession(request, env);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const result = await db.prepare("SELECT * FROM registrations ORDER BY created_at DESC LIMIT 300").all();
  return json({ success: true, registrations: result.results });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdminSession(request, env);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const { id, status } = await request.json() as { id?: number; status?: string };
  const allowed = ["pending", "contacted", "confirmed", "cancelled"];
  if (!id || !status || !allowed.includes(status)) return json({ success: false, message: "درخواست معتبر نیست." }, 422);
  await db.prepare("UPDATE registrations SET status=? WHERE id=?").bind(status, id).run();
  return json({ success: true });
};
