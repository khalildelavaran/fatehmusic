export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json } from "../../../server/admin-auth";
import { listTopics } from "../../../ai/content-engine/db";
import type { TopicStatus } from "../../../ai/content-engine/types";

const VALID_STATUSES: TopicStatus[] = ["candidate", "approved", "rejected", "used"];
const COLUMNS = [
  "id", "title", "status", "score_total", "intent", "modifier_type",
  "category", "related_course_title", "audience", "level", "reasoning", "created_at"
] as const;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const GET: APIRoute = async ({ request, url }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const statusParam = url.searchParams.get("status");
  const status = statusParam && VALID_STATUSES.includes(statusParam as TopicStatus) ? (statusParam as TopicStatus) : undefined;
  const topics = await listTopics(db, { status, limit: 5000 });

  const rows = [COLUMNS.join(",")];
  for (const topic of topics) {
    rows.push(COLUMNS.map((col) => csvEscape((topic as unknown as Record<string, unknown>)[col])).join(","));
  }
  const csv = "\uFEFF" + rows.join("\r\n"); // BOM so Excel opens Persian text as UTF-8 correctly

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="content-topics-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
};
