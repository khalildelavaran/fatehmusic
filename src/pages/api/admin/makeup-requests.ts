export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listMakeupRequests, reviewMakeupRequest, isMakeupRequestStatus, type MakeupRequestStatus } from "../../../server/makeup-requests";
import { recordAuditEvent } from "../../../server/audit-log";
import { createNotification } from "../../../server/in-app-notifications";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = isMakeupRequestStatus(statusParam) ? statusParam : null;
  const enrollmentId = url.searchParams.get("enrollmentId") ? Number(url.searchParams.get("enrollmentId")) : null;

  const requests = await listMakeupRequests(db, { status, enrollmentId });
  return json({ success: true, requests });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  let body: { id?: number; status?: MakeupRequestStatus; reviewNote?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه درخواست معتبر نیست." }, 422);
  if (!isMakeupRequestStatus(body.status)) return json({ success: false, message: "وضعیت درخواست معتبر نیست." }, 422);

  // Admin here only performs approve/reject (not "scheduled"/"completed",
  // which are set automatically once the makeup class_session itself is
  // created and later completed -- see attachMakeupSession /
  // markMakeupRequestCompleted).
  if (body.status !== "approved" && body.status !== "rejected") {
    return json({ success: false, message: "از این مسیر فقط تأیید یا رد درخواست ممکن است." }, 422);
  }

  const result = await reviewMakeupRequest(db, id, body.status, 0, body.reviewNote);
  if ("error" in result) return json({ success: false, message: result.error }, 422);

  const requestRow = await db.prepare("SELECT enrollment_id FROM makeup_requests WHERE id = ?").bind(id).first<{ enrollment_id: number }>();
  const enrollment = requestRow
    ? await db.prepare("SELECT student_id FROM enrollments WHERE id = ?").bind(requestRow.enrollment_id).first<{ student_id: number }>()
    : null;

  await recordAuditEvent(db, {
    actor: { type: "admin", label: "admin-api" },
    action: `makeup_request.${body.status}`,
    entityType: "makeup_request",
    entityId: id,
    metadata: { reviewNote: body.reviewNote ?? "" },
  });

  if (enrollment) {
    await createNotification(db, {
      recipientType: "student",
      recipientId: enrollment.student_id,
      type: "system",
      title: body.status === "approved" ? "درخواست جلسه جبرانی تأیید شد" : "درخواست جلسه جبرانی رد شد",
      body: body.reviewNote ?? "",
      entityType: "makeup_request",
      entityId: id,
    });
  }

  return json({ success: true });
};
