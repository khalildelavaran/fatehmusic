export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, getAdminSession } from "../../../server/admin-auth";

const fields = `id, slug, title, excerpt, content, topic, related_course_slug, related_course_title, status, meta_title, meta_description, created_at, updated_at, published_at`;

async function requireAdmin(request: Request): Promise<Response | null> {
  return (await getAdminSession(request, env)) ? null : json({ success: false, message: "دسترسی مدیریت معتبر نیست." }, 401);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const result = await db.prepare(`SELECT ${fields} FROM blog_posts ORDER BY updated_at DESC`).all();
  return json({ success: true, posts: result.results });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const post = await request.json() as Record<string, string>;
  const status = post.status === "published" ? "published" : "draft";
  const publishedAt = status === "published" ? new Date().toISOString() : null;

  if (post.id) {
    await db.prepare(`UPDATE blog_posts SET slug=?, title=?, excerpt=?, content=?, topic=?, related_course_slug=?, related_course_title=?, status=?, meta_title=?, meta_description=?, updated_at=datetime('now'), published_at=COALESCE(published_at, ?) WHERE id=?`)
      .bind(post.slug, post.title, post.excerpt, post.content, post.topic, post.related_course_slug || null, post.related_course_title || null, status, post.meta_title || null, post.meta_description || null, publishedAt, post.id).run();
  } else {
    await db.prepare(`INSERT INTO blog_posts (slug,title,excerpt,content,topic,related_course_slug,related_course_title,status,meta_title,meta_description,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(post.slug, post.title, post.excerpt, post.content, post.topic, post.related_course_slug || null, post.related_course_title || null, status, post.meta_title || null, post.meta_description || null, publishedAt).run();
  }
  return json({ success: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const { id } = await request.json() as { id?: number };
  if (!id) return json({ success: false, message: "شناسه نوشته ارسال نشده است." }, 422);
  await db.prepare("DELETE FROM blog_posts WHERE id=?").bind(id).run();
  return json({ success: true });
};
