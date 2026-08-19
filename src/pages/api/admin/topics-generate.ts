export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { runTopicDiscovery } from "../../../ai/content-engine/pipeline";

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;
  const db = env.DB as unknown as D1Database;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const summary = await runTopicDiscovery(db);
  if (summary.status === "failed") {
    return json({ success: false, message: `اجرای کشف موضوع شکست خورد: ${summary.errorMessage}` }, 500);
  }
  return json({
    success: true,
    message: `${summary.candidatesGenerated} کاندیدا تولید شد؛ ${summary.candidatesAfterDedup} مورد پس از حذف تکراری‌ها ماند؛ ${summary.candidatesApproved} مورد به‌طور خودکار تأیید شد.`,
    summary
  });
};
