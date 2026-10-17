export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { courses } from "../../../data/courses.js";
import { buildArticleSeoFields } from "../../../seo/v2/content-strategy/article-metadata.js";

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
  if (denied) return denied;

  let input: { title?: unknown; topic?: unknown };
  try {
    input = await request.json() as { title?: unknown; topic?: unknown };
  } catch {
    return json({ success: false, message: "درخواست نامعتبر است." }, 400);
  }

  const fields = buildArticleSeoFields({
    title: String(input.title ?? "").slice(0, 240),
    topic: String(input.topic ?? "").slice(0, 160),
    courses
  });

  return json({ success: true, fields });
};
