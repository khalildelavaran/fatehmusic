export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../../server/admin-auth";
import { getDailyPlannerSuggestions, parsePlannerSessionId } from "../../../../server/daily-planner-suggestions";

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const sessionId = parsePlannerSessionId(url.searchParams.get("sessionId"));
    const limit = Number(url.searchParams.get("limit"));
    if (!sessionId) return json({ success: false, message: "شناسه جلسه معتبر نیست." }, 422);

    const result = await getDailyPlannerSuggestions(env.DB, sessionId, Number.isFinite(limit) ? limit : 8);
    return json({ success: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SESSION_NOT_FOUND") return json({ success: false, message: "جلسه موردنظر پیدا نشد." }, 404);
    if (code === "SESSION_CANCELLED") return json({ success: false, message: "جلسه لغوشده قابل جابه‌جایی نیست." }, 409);
    console.error("[admin/daily-planner/suggestions] failed:", error);
    return json({ success: false, message: "پیشنهاد زمان جایگزین با خطا مواجه شد." }, 500);
  }
};
