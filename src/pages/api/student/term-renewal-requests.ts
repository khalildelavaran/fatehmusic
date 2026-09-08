export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";
import { createTermRenewalRequest, listTermRenewalRequests } from "../../../server/student-requests";
import { recordAuditEvent } from "../../../server/audit-log";

async function resolveStudentId(db: D1Database, nationalCode: string): Promise<number | null> {
  const row = await db.prepare("SELECT id FROM students WHERE national_code = ?").bind(nationalCode).first<{ id: number }>();
  return row?.id ?? null;
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;
  const studentId = await resolveStudentId(db, session.nationalCode);
  if (!studentId) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  const requests = await listTermRenewalRequests(db, { studentId });
  return json({ success: true, requests });
};

export const POST: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;
  const studentId = await resolveStudentId(db, session.nationalCode);
  if (!studentId) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  let body: { enrollmentId?: number; instructorId?: number | null; note?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  const result = await createTermRenewalRequest(db, {
    enrollmentId: Number(body.enrollmentId),
    studentId,
    instructorId: body.instructorId ? Number(body.instructorId) : null,
    note: body.note ?? "",
  });

  if ("error" in result) return json({ success: false, message: result.error }, 422);

  await recordAuditEvent(db, {
    actor: { type: "student", id: studentId },
    action: "term_renewal_request.create",
    entityType: "term_renewal_request",
    entityId: result.id,
    metadata: { enrollmentId: body.enrollmentId },
  });

  return json({ success: true, id: result.id }, 201);
};
