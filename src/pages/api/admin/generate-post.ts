export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { generateDailyPost } from "../../../server/ai-post-generator";

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  const runtimeEnv = env as unknown as { DB: D1Database; AI: Ai };
  const result = await generateDailyPost(runtimeEnv);
  return json(result, result.success ? 200 : 500);
};
