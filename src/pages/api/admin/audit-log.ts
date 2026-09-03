export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listAuditLog } from "../../../server/audit-log";

export const GET: APIRoute = async ({ request }) => {
  // Audit log access is intentionally admin-only, not registrar: it exists
  // to review sensitive operations, including ones registrars perform.
  const denied = await requireRole(request, env, [ROLES.ADMIN]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const result = await listAuditLog(db, {
    entityType: url.searchParams.get("entityType"),
    entityId: url.searchParams.get("entityId") ? Number(url.searchParams.get("entityId")) : undefined,
    actorType: url.searchParams.get("actorType") as any,
    page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
    pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
  });

  return json({ success: true, ...result });
};
