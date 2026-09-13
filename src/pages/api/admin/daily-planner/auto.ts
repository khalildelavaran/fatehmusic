export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../../server/admin-auth";
import { getDailyDashboard } from "../../../../server/daily-dashboard";
import { listActiveRooms } from "../../../../server/rooms";
import { buildDailyAutoPlan } from "../../../../server/daily-auto-planner";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";
    if (!DATE_RE.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

    const removeRaw = url.searchParams.get("removeSessionIds") || "";
    const removeSessionIds = removeRaw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    const [sessions, rooms] = await Promise.all([
      getDailyDashboard(env.DB, date),
      listActiveRooms(env.DB),
    ]);

    const plan = await buildDailyAutoPlan(env.DB, date, sessions, rooms, { removeSessionIds });
    return json({ success: true, plan });
  } catch (error) {
    console.error("[admin/daily-planner/auto] failed:", error);
    return json({ success: false, message: "ساخت چینش هوشمند روز با خطا مواجه شد." }, 500);
  }
};
