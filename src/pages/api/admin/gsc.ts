export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { runScheduledSearchConsoleSync } from "../../../seo/v2/providers/search-console-sync.js";
import { getLatestGscSyncRun } from "../../../seo/v2/providers/search-console-store.js";

const runtimeEnv = env as unknown as Record<string, any>;

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  const latestRun = await getLatestGscSyncRun(runtimeEnv.DB, runtimeEnv.GSC_SITE_URL || "https://fatehmusic.ir");
  return json({
    success: true,
    configured: Boolean(runtimeEnv.GSC_CLIENT_EMAIL && runtimeEnv.GSC_PRIVATE_KEY && runtimeEnv.GSC_SITE_URL),
    latestRun
  });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  try {
    const result = await runScheduledSearchConsoleSync(runtimeEnv);
    if (result.status === "not_configured") {
      return json({ success: false, message: "Google Search Console هنوز تنظیم نشده است.", result }, 503);
    }
    return json({ success: true, result });
  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : "GSC_SYNC_FAILED"
    }, 500);
  }
};
