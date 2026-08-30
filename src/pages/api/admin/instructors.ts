export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import {
  createInstructor,
  getInstructorProfile,
  listInstructors,
  updateInstructor,
  validateInstructorInput,
  type InstructorInput
} from "../../../server/instructors";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) return json({ success: false, message: "شناسه مدرس معتبر نیست." }, 422);
    const profile = await getInstructorProfile(db, numericId);
    if (!profile) return json({ success: false, message: "مدرسی با این شناسه یافت نشد." }, 404);
    return json({ success: true, profile });
  }

  const result = await listInstructors(db, {
    search: url.searchParams.get("search"),
    status: url.searchParams.get("status"),
    page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
    pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined
  });

  return json({ success: true, ...result });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: InstructorInput;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  const validation = validateInstructorInput(body, { isCreate: true });
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

  const id = await createInstructor(db, body);
  const profile = await getInstructorProfile(db, id);
  return json({ success: true, profile }, 201);
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { id?: number } & InstructorInput;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  const { id, ...patch } = body;
  if (!id || !Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه مدرس معتبر نیست." }, 422);

  const validation = validateInstructorInput(patch, { isCreate: false });
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

  const ok = await updateInstructor(db, id, patch);
  if (!ok) return json({ success: false, message: "به‌روزرسانی مدرس با خطا مواجه شد." }, 500);

  const profile = await getInstructorProfile(db, id);
  if (!profile) return json({ success: false, message: "مدرسی با این شناسه یافت نشد." }, 404);
  return json({ success: true, profile });
};
