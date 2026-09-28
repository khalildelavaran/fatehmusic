export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { runDailyArticleGeneration, type GenerateOptions } from "../../../ai/content-engine/article-generator";

/**
 * Manual, per-topic AI article generation (admin only).
 * Body: { id: number }                       -> a topic from the queue
 *    or { title, relatedCourseSlug?, relatedCourseTitle?, topicLabel? } -> a strategy opportunity
 * The daily automatic run is disabled by default (see src/worker.ts).
 */
export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ success: false, message: "درخواست نامعتبر است." }, 400);
  }

  const options: GenerateOptions = {};
  const id = Number(body.id);
  if (Number.isInteger(id) && id > 0) {
    options.topicId = id;
  } else if (typeof body.title === "string" && body.title.trim().length >= 5 && body.title.length <= 200) {
    const text = (value: unknown, max = 200) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
    options.manualTopic = {
      title: body.title.trim(),
      relatedCourseSlug: text(body.relatedCourseSlug, 100),
      relatedCourseTitle: text(body.relatedCourseTitle),
      topicLabel: text(body.topicLabel)
    };
  } else {
    return json({ success: false, message: "شناسه یا عنوان موضوع ارسال نشده است." }, 400);
  }

  const runtimeEnv = env as unknown as { DB: D1Database; ANTHROPIC_API_KEY?: string };
  const result = await runDailyArticleGeneration(runtimeEnv, options);
  return json(result, result.success ? 200 : 500);
};
