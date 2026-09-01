export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { getTodayDashboardRows } from "../../../server/today-dashboard-repository";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ success: false, message: "تاریخ باید با فرمت YYYY-MM-DD باشد." }, 422);
  }

  try {
    const data = await getTodayDashboardRows(db, date);
    return json({ success: true, date, ...data });
  } catch (error) {
    console.error("[admin/today-dashboard]", error);
    return json({ success: false, message: "دریافت داشبورد روزانه با خطا مواجه شد." }, 500);
  }
};
