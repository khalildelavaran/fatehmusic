export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { getDashboardOverview } from "../../../server/admin-reports";

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const today = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

  try {
    const overview = await getDashboardOverview(db, today);
    return json({ success: true, date: today, overview });
  } catch (error) {
    console.error("[admin/overview]", error);
    return json({ success: false, message: "دریافت اطلاعات داشبورد با خطا مواجه شد." }, 500);
  }
};
