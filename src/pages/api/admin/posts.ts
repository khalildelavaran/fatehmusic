export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { markSeoActionPublished, markSeoActionUnpublished } from "../../../seo/v2/seo-action-store.js";
import { submitToIndexNow } from "../../../server/indexnow";
import { markTopicPublished, markTopicDraftPost, releaseTopicForDeletedPost } from "../../../ai/content-engine/db";

const fields = `id, slug, title, excerpt, content, topic, related_course_slug, related_course_title, status, meta_title, meta_description, created_at, updated_at, published_at, is_ai_generated`;

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN]);
}

function validatePostSlug(value: unknown): string | null {
  const slug = String(value ?? "").trim();
  if (!slug) return "اسلاگ نوشته الزامی است.";
  if (slug.length > 80) return "اسلاگ نوشته نباید بیشتر از ۸۰ نویسه باشد.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "اسلاگ باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.";
  }
  return null;
}

async function ensureUniqueSlug(
  db: D1Database,
  slug: string,
  postId?: number
): Promise<string | null> {
  const row = await db.prepare(
    "SELECT id FROM blog_posts WHERE slug = ? LIMIT 1"
  ).bind(slug).first<{ id: number }>();
  if (row && Number(row.id) !== Number(postId || 0)) {
    return "این اسلاگ قبلاً برای یک نوشته استفاده شده است.";
  }
  return null;
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
  const slugError = validatePostSlug(post.slug);
  if (slugError) return json({ success: false, message: slugError }, 422);

  const slug = String(post.slug).trim();
  const existingId = post.id ? Number(post.id) : undefined;
  const slugConflict = await ensureUniqueSlug(db, slug, existingId);
  if (slugConflict) return json({ success: false, message: slugConflict }, 409);

  const status = post.status === "published" ? "published" : "draft";
  const publishedAt = status === "published" ? new Date().toISOString() : null;

  if (post.id) {
    const existing = await db.prepare("SELECT slug, title, published_at FROM blog_posts WHERE id=?").bind(post.id).first<{ slug: string; title: string; published_at: string | null }>();
    const nextPublishedAt = status === "published"
      ? (existing?.published_at || publishedAt)
      : null;
    await db.prepare(`UPDATE blog_posts SET slug=?, title=?, excerpt=?, content=?, topic=?, related_course_slug=?, related_course_title=?, status=?, meta_title=?, meta_description=?, updated_at=datetime('now'), published_at=? WHERE id=?`)
      .bind(slug, post.title, post.excerpt, post.content, post.topic, post.related_course_slug || null, post.related_course_title || null, status, post.meta_title || null, post.meta_description || null, nextPublishedAt, post.id).run();
    if (status === "published") {
      await markTopicPublished(db, Number(post.id));
      await markSeoActionPublished(db, {
        targetPostId: Number(post.id),
        targetUrl: `https://fatehmusic.ir/blog/${slug}`,
        targetSlug: slug,
        targetTitle: post.title,
        previousTargetSlug: existing?.slug || null,
        previousTargetTitle: existing?.title || null
      });
    } else {
      await markTopicDraftPost(db, Number(post.id));
      await markSeoActionUnpublished(db, {
        targetPostId: Number(post.id),
        targetSlug: slug,
        targetTitle: post.title
      });
    }
  } else {
    const inserted = await db.prepare(`INSERT INTO blog_posts (slug,title,excerpt,content,topic,related_course_slug,related_course_title,status,meta_title,meta_description,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(slug, post.title, post.excerpt, post.content, post.topic, post.related_course_slug || null, post.related_course_title || null, status, post.meta_title || null, post.meta_description || null, publishedAt).run();
    if (status === "published") {
      await markSeoActionPublished(db, {
        targetPostId: Number(inserted.meta?.last_row_id || 0) || null,
        targetUrl: `https://fatehmusic.ir/blog/${post.slug}`,
        targetSlug: post.slug,
        targetTitle: post.title
      });
    }
  }
  if (status === "published") {
    await submitToIndexNow([`https://fatehmusic.ir/blog/${slug}`, "https://fatehmusic.ir/blog", "https://fatehmusic.ir/rss.xml"]);
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
  const existing = await db.prepare("SELECT slug, title FROM blog_posts WHERE id=?").bind(id).first<{ slug: string; title: string }>();
  await db.prepare("DELETE FROM blog_posts WHERE id=?").bind(id).run();
  await releaseTopicForDeletedPost(db, Number(id));
  if (existing) {
    await markSeoActionUnpublished(db, {
      targetPostId: Number(id),
      targetSlug: existing.slug,
      targetTitle: existing.title,
      status: "removed"
    });
  }
  return json({ success: true });
};
