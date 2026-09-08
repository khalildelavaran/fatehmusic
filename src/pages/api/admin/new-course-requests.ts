export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES, type AdminEnv } from "../../../server/admin-auth";
import { listNewCourseRequests, reviewNewCourseRequest, isRequestStatus } from "../../../server/student-requests";
import { recordAuditEvent } from "../../../server/audit-log";
import { createNotification } from "../../../server/in-app-notifications";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

export const GET: APIRoute = async ({ request, url }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = (env as AdminEnv).DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const statusParam = url.searchParams.get("status");
  const status = isRequestStatus(statusParam) ? statusParam : null;
  const requests = await listNewCourseRequests(db, { status });
  return json({ success: true, requests });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = (env as AdminEnv).DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { id?: number; status?: "approved" | "rejected"; reviewNote?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه درخواست معتبر نیست." }, 422);
  if (body.status !== "approved" && body.status !== "rejected") {
    return json({ success: false, message: "وضعیت درخواست معتبر نیست." }, 422);
  }

  const result = await reviewNewCourseRequest(db, id, body.status, 0, body.reviewNote);
  if ("error" in result) return json({ success: false, message: result.error }, 422);

  const requestRow = await db.prepare("SELECT student_id FROM new_course_requests WHERE id = ?").bind(id).first<{ student_id: number }>();

  await recordAuditEvent(db, {
    actor: { type: "admin", label: "admin-api" },
    action: `new_course_request.${body.status}`,
    entityType: "new_course_request",
    entityId: id,
    metadata: { reviewNote: body.reviewNote ?? "" },
  });

  if (requestRow) {
    await createNotification(db, {
      recipientType: "student",
      recipientId: requestRow.student_id,
      type: "system",
      title: body.status === "approved" ? "درخواست ثبت‌نام دوره‌ی جدید تأیید شد" : "درخواست ثبت‌نام دوره‌ی جدید رد شد",
      body: body.reviewNote ?? "",
      entityType: "new_course_request",
      entityId: id,
    });
  }

  return json({ success: true });
};
