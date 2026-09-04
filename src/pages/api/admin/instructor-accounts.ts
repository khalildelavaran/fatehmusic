export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { hashInstructorPassword, normalizeUsername } from "../../../server/instructor-auth";
import { recordAuditEvent } from "../../../server/audit-log";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

/**
 * Creates or resets login credentials for an instructor's self-service
 * portal account. Does not return the generated password in logs; the
 * admin must relay it to the instructor out of band.
 */
export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { instructorId?: number; username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const instructorId = Number(body.instructorId);
  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    return json({ success: false, message: "شناسه مدرس معتبر نیست." }, 422);
  }
  const username = normalizeUsername(body.username ?? "");
  if (!username) return json({ success: false, message: "نام کاربری الزامی است." }, 422);
  const password = body.password ?? "";
  if (password.length < 8) return json({ success: false, message: "رمز عبور باید حداقل ۸ کاراکتر باشد." }, 422);

  const instructor = await db.prepare("SELECT id FROM instructors WHERE id = ?").bind(instructorId).first();
  if (!instructor) return json({ success: false, message: "مدرسی با این شناسه یافت نشد." }, 404);

  const usernameTaken = await db
    .prepare("SELECT id FROM instructor_accounts WHERE username = ? AND instructor_id != ?")
    .bind(username, instructorId)
    .first();
  if (usernameTaken) return json({ success: false, message: "این نام کاربری قبلاً استفاده شده است." }, 409);

  const passwordHash = await hashInstructorPassword(password);

  try {
    const existing = await db.prepare("SELECT id FROM instructor_accounts WHERE instructor_id = ?").bind(instructorId).first<{ id: number }>();
    if (existing) {
      await db
        .prepare("UPDATE instructor_accounts SET username = ?, password_hash = ?, must_change_password = 1, is_active = 1, updated_at = datetime('now') WHERE id = ?")
        .bind(username, passwordHash, existing.id)
        .run();
    } else {
      await db
        .prepare("INSERT INTO instructor_accounts (instructor_id, username, password_hash, must_change_password, is_active) VALUES (?, ?, ?, 1, 1)")
        .bind(instructorId, username, passwordHash)
        .run();
    }

    await recordAuditEvent(db, {
      actor: { type: "admin", label: "admin-api" },
      action: existing ? "instructor_account.reset" : "instructor_account.create",
      entityType: "instructor_account",
      entityId: instructorId,
      metadata: { username },
    });

    return json({ success: true, message: "حساب کاربری مدرس با موفقیت تنظیم شد." });
  } catch (error) {
    console.error("[admin/instructor-accounts] provisioning failed", error);
    return json({ success: false, message: "تنظیم حساب کاربری با خطای سرور مواجه شد." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { instructorId?: number; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const instructorId = Number(body.instructorId);
  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    return json({ success: false, message: "شناسه مدرس معتبر نیست." }, 422);
  }
  if (typeof body.isActive !== "boolean") {
    return json({ success: false, message: "وضعیت فعال‌بودن معتبر نیست." }, 422);
  }

  const result = await db
    .prepare("UPDATE instructor_accounts SET is_active = ?, updated_at = datetime('now') WHERE instructor_id = ?")
    .bind(body.isActive ? 1 : 0, instructorId)
    .run();

  if (!result || (result.meta && result.meta.changes === 0)) {
    return json({ success: false, message: "حساب کاربری مدرس یافت نشد." }, 404);
  }

  await recordAuditEvent(db, {
    actor: { type: "admin", label: "admin-api" },
    action: body.isActive ? "instructor_account.activate" : "instructor_account.deactivate",
    entityType: "instructor_account",
    entityId: instructorId,
  });

  return json({ success: true });
};
