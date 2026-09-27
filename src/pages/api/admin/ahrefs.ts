export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { getAhrefsConfig, getLatestAhrefsMarketSnapshot, syncAhrefsMarketIntelligence } from "../../../seo/v2/providers/ahrefs.js";

const runtimeEnv = env as unknown as Record<string, any>;

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  const config = getAhrefsConfig(runtimeEnv);
  const [metrics, competitors, refdomains, organicKeywords] = config.enabled
    ? await Promise.all([
        getLatestAhrefsMarketSnapshot(runtimeEnv.DB, { target: config.target, country: config.country, snapshotType: "metrics" }),
        getLatestAhrefsMarketSnapshot(runtimeEnv.DB, { target: config.target, country: config.country, snapshotType: "organic-competitors" }),
        getLatestAhrefsMarketSnapshot(runtimeEnv.DB, { target: config.target, country: config.country, snapshotType: "refdomains" }),
        getLatestAhrefsMarketSnapshot(runtimeEnv.DB, { target: config.target, country: config.country, snapshotType: "organic-keywords" })
      ])
    : [null, null, null, null];

  return json({
    success: true,
    configured: config.enabled,
    target: config.target,
    country: config.country,
    metrics,
    competitors,
    refdomains,
    organicKeywords
  });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  try {
    const config = getAhrefsConfig(runtimeEnv);
    if (!config.enabled) {
      return json({ success: false, message: "Ahrefs هنوز تنظیم نشده است." }, 503);
    }
    const result = await syncAhrefsMarketIntelligence({ db: runtimeEnv.DB, env: runtimeEnv });
    return json({ success: true, result });
  } catch (error) {
    return json({ success: false, message: error instanceof Error ? error.message : "AHREFS_SYNC_FAILED" }, 500);
  }
};
