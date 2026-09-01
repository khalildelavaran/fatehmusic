export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { getCourse, listCourses, updateCourse, validateCoursePatch } from "../../../server/courses";
import { syncCourseInstructorRelations } from "../../../server/course-instructor-relations";

async function requireAdmin(request: Request): Promise<Response | null> { return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]); }

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request); if (denied) return denied;
  const db = env.DB; const url = new URL(request.url); const id = url.searchParams.get("id");
  if (id) { const numericId = Number(id); if (!Number.isInteger(numericId) || numericId <= 0) return json({ success: false, message: "شناسه دوره معتبر نیست." }, 422); const course = await getCourse(db, numericId); if (!course) return json({ success: false, message: "دوره‌ای با این شناسه یافت نشد." }, 404); return json({ success: true, course }); }
  return json({ success: true, courses: await listCourses(db) });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  let body: { id?: number; [key: string]: any };
  try { body = await request.json(); } catch { return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400); }
  const id = Number(body.id); if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه دوره معتبر نیست." }, 422);
  const { id: _id, ...patch } = body; const errors = validateCoursePatch(patch); if (errors.length) return json({ success: false, message: errors.join(" ") }, 422);
  try { const ok = await updateCourse(db, id, patch); if (!ok) return json({ success: false, message: "دوره یافت نشد یا به‌روزرسانی انجام نشد." }, 404); const current = await getCourse(db, id); if (!current) return json({ success: false, message: "دوره پس از ذخیره یافت نشد." }, 500); if (Array.isArray(patch.instructors)) await syncCourseInstructorRelations(db, String(current.slug), patch.instructors); const course = await getCourse(db, id); return json({ success: true, course }); } catch (error) { console.error("[admin/courses] update failed", error); return json({ success: false, message: "ذخیره تغییرات دوره با خطا مواجه شد." }, 500); }
};
