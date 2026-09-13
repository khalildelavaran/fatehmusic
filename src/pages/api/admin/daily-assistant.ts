export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { getDailyDashboard } from "../../../server/daily-dashboard";
import { askDailyAssistant } from "../../../ai/daily-assistant";
import { listActiveRooms } from "../../../server/rooms";

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as { date?: unknown; question?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);
  if (!question) return json({ success: false, message: "درخواست منشی خالی است." }, 422);
  if (question.length > 1200) return json({ success: false, message: "درخواست بیش از حد طولانی است." }, 422);
  if (!env.DB) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  try {
    const [sessions, rooms] = await Promise.all([
      getDailyDashboard(env.DB, date),
      listActiveRooms(env.DB),
    ]);
    const runtimeEnv = env as unknown as { ANTHROPIC_API_KEY?: string };
    const result = await askDailyAssistant(runtimeEnv.ANTHROPIC_API_KEY, date, sessions, question, rooms);
    return json(result, result.success ? 200 : 502);
  } catch (error) {
    console.error("[admin/daily-assistant] request failed:", error);
    return json({ success: false, message: "دستیار روزانه با خطا مواجه شد." }, 500);
  }
};
