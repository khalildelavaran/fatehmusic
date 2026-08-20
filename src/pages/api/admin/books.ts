export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";

interface BookInput {
  course_slug?: string;
  title?: string;
  author?: string | null;
  level?: string | null;
  cover_image?: string | null;
  display_order?: number;
}

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env as AdminEnv, [ROLES.ADMIN]);
}

export const GET: APIRoute = async ({ request, url }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const courseSlug = url.searchParams.get("course_slug");
  const result = courseSlug
    ? await db.prepare("SELECT * FROM course_books WHERE course_slug = ? ORDER BY display_order ASC, id ASC").bind(courseSlug).all()
    : await db.prepare("SELECT * FROM course_books ORDER BY course_slug ASC, display_order ASC, id ASC").all();

  return json({ success: true, books: result.results });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const body = (await request.json()) as BookInput;
  if (!body.course_slug || !body.title) {
    return json({ success: false, message: "دوره و عنوان کتاب الزامی هستند." }, 422);
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO course_books (course_slug, title, author, level, cover_image, display_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        body.course_slug,
        body.title,
        body.author || null,
        body.level || null,
        body.cover_image || null,
        body.display_order ?? 0
      )
      .run();
    return json({ success: true, id: result.meta.last_row_id });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ success: false, message: `ذخیره شکست خورد: ${detail}` }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const body = (await request.json()) as BookInput & { id?: number };
  if (!body.id) return json({ success: false, message: "شناسه کتاب ارسال نشده است." }, 422);

  await db
    .prepare(
      `UPDATE course_books
       SET course_slug = ?, title = ?, author = ?, level = ?, cover_image = ?, display_order = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      body.course_slug,
      body.title,
      body.author || null,
      body.level || null,
      body.cover_image || null,
      body.display_order ?? 0,
      body.id
    )
    .run();
  return json({ success: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const { id } = (await request.json()) as { id?: number };
  if (!id) return json({ success: false, message: "شناسه کتاب ارسال نشده است." }, 422);
  await db.prepare("DELETE FROM course_books WHERE id = ?").bind(id).run();
  return json({ success: true });
};
