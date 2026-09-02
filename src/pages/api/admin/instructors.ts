export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { createInstructor, getInstructorProfile, listInstructors, updateInstructor, validateInstructorInput, type InstructorInput } from "../../../server/instructors";
import { syncInstructorCourseRelations } from "../../../server/course-instructor-relations";
import { instructors as staticInstructors } from "../../../data/instructors.js";

async function requireAdmin(request: Request): Promise<Response | null> { return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]); }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request); if (denied) return denied;
  const db = env.DB; if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const url = new URL(request.url); const id = url.searchParams.get("id");
  if (id) { const numericId = Number(id); if (!Number.isInteger(numericId) || numericId <= 0) return json({ success: false, message: "شناسه مدرس معتبر نیست." }, 422); const profile = await getInstructorProfile(db, numericId); if (!profile) return json({ success: false, message: "مدرسی با این شناسه یافت نشد." }, 404); return json({ success: true, profile }); }
  try { const result = await listInstructors(db, { search: url.searchParams.get("search"), status: url.searchParams.get("status"), page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined, pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined }); if (result.instructors.length > 0 || staticInstructors.length === 0) return json({ success: true, ...result }); } catch (error) { console.error("[admin/instructors] D1 list failed; using static roster", error); }
  const search = (url.searchParams.get("search") ?? "").trim().toLocaleLowerCase("fa-IR"); const status = url.searchParams.get("status") ?? ""; const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1); const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20));
  const filtered = staticInstructors.filter((inst: any) => inst.active !== false).filter((inst: any) => !search || `${inst.name ?? ""} ${inst.identity?.firstName ?? ""} ${inst.identity?.lastName ?? ""} ${inst.position ?? ""}`.toLocaleLowerCase("fa-IR").includes(search)).filter(() => status !== "inactive");
  const total = filtered.length; const start = (page - 1) * pageSize; const rows = filtered.slice(start, start + pageSize).map((inst: any) => ({ id: Number(inst.id), slug: inst.slug ?? "", firstName: inst.identity?.firstName ?? inst.name?.split(" ")[0] ?? "", lastName: inst.identity?.lastName ?? inst.name?.split(" ").slice(1).join(" ") ?? "", phone: "", email: "", specialty: inst.position ?? inst.content?.excerpt ?? "", instruments: Array.isArray(inst.relations?.courses) ? inst.relations.courses : [], biography: inst.content?.biography ?? "", notes: "", isActive: inst.active !== false, payPercentage: 50, createdAt: "", updatedAt: "", studentCount: 0 }));
  return json({ success: true, instructors: rows, total, page, pageSize });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request); if (denied) return denied; const db = env.DB; if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  try { const body: InstructorInput = await request.json(); const validation = validateInstructorInput(body, { isCreate: true }); if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422); const id = await createInstructor(db, body); if (body.instruments !== undefined) { try { await syncInstructorCourseRelations(db, id, body.instruments); } catch (error) { console.error("[admin/instructors] course relation sync failed after create", error); } } const profile = await getInstructorProfile(db, id); return json({ success: true, profile }, 201); } catch (error) { console.error("[admin/instructors] create failed", error); const message = errorMessage(error); if (/pay_percentage|no such column/i.test(message)) return json({ success: false, message: "ساختار دیتابیس به‌روز نیست؛ migration مربوط به سهم مدرس روی دیتابیس اجرا نشده است." }, 500); return json({ success: false, message: "ثبت مدرس با خطای سرور مواجه شد." }, 500); }
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request); if (denied) return denied; const db = env.DB; if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  try {
    const body: { id?: number } & InstructorInput = await request.json();
    const { id, ...patch } = body;
    if (!id || !Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه مدرس معتبر نیست." }, 422);
    const validation = validateInstructorInput(patch, { isCreate: false });
    if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

    const ok = await updateInstructor(db, id, patch);
    if (!ok) return json({ success: false, message: "به‌روزرسانی مدرس با خطا مواجه شد." }, 500);

    if (patch.instruments !== undefined) {
      try {
        await syncInstructorCourseRelations(db, id, patch.instruments);
      } catch (error) {
        // Instructor data is already persisted in the canonical instructors row.
        // Course-overrides are a secondary compatibility mirror and must not make
        // the whole instructor save fail.
        console.error("[admin/instructors] course relation sync failed after instructor update", error);
      }
    }

    const profile = await getInstructorProfile(db, id);
    if (!profile) return json({ success: false, message: "مدرسی با این شناسه یافت نشد." }, 404);
    return json({ success: true, profile });
  } catch (error) {
    console.error("[admin/instructors] update failed", error);
    const message = errorMessage(error);
    if (/pay_percentage|no such column/i.test(message)) return json({ success: false, message: "ساختار دیتابیس به‌روز نیست؛ migration مربوط به سهم مدرس روی دیتابیس اجرا نشده است." }, 500);
    if (/course_overrides|no such table/i.test(message)) return json({ success: false, message: "جدول تنظیمات دوره‌ها در دیتابیس موجود نیست." }, 500);
    return json({ success: false, message: "ذخیره اطلاعات مدرس با خطای سرور مواجه شد." }, 500);
  }
};
