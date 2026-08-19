export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listTopics, updateTopicStatus, deleteTopic } from "../../../ai/content-engine/db";
import type { TopicStatus } from "../../../ai/content-engine/types";

const VALID_STATUSES: TopicStatus[] = ["candidate", "approved", "rejected", "used"];

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN]);
}

export const GET: APIRoute = async ({ request, url }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const statusParam = url.searchParams.get("status");
  const status = statusParam && VALID_STATUSES.includes(statusParam as TopicStatus) ? (statusParam as TopicStatus) : undefined;
  const topics = await listTopics(db, { status });
  return json({ success: true, topics });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const body = (await request.json()) as { id?: number; status?: string };
  if (!body.id || !body.status || !VALID_STATUSES.includes(body.status as TopicStatus)) {
    return json({ success: false, message: "شناسه یا وضعیت نامعتبر است." }, 422);
  }
  await updateTopicStatus(db, body.id, body.status as TopicStatus);
  return json({ success: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const { id } = (await request.json()) as { id?: number };
  if (!id) return json({ success: false, message: "شناسه موضوع ارسال نشده است." }, 422);
  await deleteTopic(db, id);
  return json({ success: true });
};
