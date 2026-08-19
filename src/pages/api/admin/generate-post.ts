export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { runDailyArticleGeneration } from "../../../ai/content-engine/article-generator";

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  const runtimeEnv = env as unknown as { DB: D1Database; DEEPSEEK_API_KEY?: string };
  const result = await runDailyArticleGeneration(runtimeEnv);
  return json(result, result.success ? 200 : 500);
};
