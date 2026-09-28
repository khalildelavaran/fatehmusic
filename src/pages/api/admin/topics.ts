export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listTopics, updateTopicStatus, deleteTopic } from "../../../ai/content-engine/db";
import type { TopicStatus } from "../../../ai/content-engine/types";

const VALID_STATUSES: TopicStatus[] = ["candidate", "approved", "generating", "drafted", "rejected", "used"];

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
  const mutableStatuses: TopicStatus[] = ["candidate", "approved", "rejected"];
  if (!body.id || !body.status || !mutableStatuses.includes(body.status as TopicStatus)) {
    return json({ success: false, message: "شناسه یا وضعیت نامعتبر است." }, 422);
  }

  const current = await db
    .prepare("SELECT status FROM content_topics WHERE id = ?")
    .bind(body.id)
    .first<{ status: TopicStatus }>();

  if (!current) {
    return json({ success: false, message: "موضوع پیدا نشد." }, 404);
  }

  // generating/drafted/used are lifecycle-owned states. They must only be
  // changed by the content-generation/publishing flow, not by an arbitrary
  // admin status edit.
  if (["generating", "drafted", "used"].includes(current.status)) {
    return json({ success: false, message: "وضعیت این موضوع در حال حاضر توسط چرخه تولید مدیریت می‌شود." }, 409);
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

  const current = await db
    .prepare("SELECT status FROM content_topics WHERE id = ?")
    .bind(id)
    .first<{ status: TopicStatus }>();

  if (!current) return json({ success: false, message: "موضوع پیدا نشد." }, 404);
  if (["generating", "drafted", "used"].includes(current.status)) {
    return json({ success: false, message: "این موضوع به یک فرایند تولید/مقاله متصل است و قابل حذف نیست." }, 409);
  }

  await deleteTopic(db, id);
  return json({ success: true });
};
