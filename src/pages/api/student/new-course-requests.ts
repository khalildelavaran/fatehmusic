export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";
import { createNewCourseRequest, listNewCourseRequests } from "../../../server/student-requests";
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

  const requests = await listNewCourseRequests(db, { studentId });
  return json({ success: true, requests });
};

export const POST: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;
  const studentId = await resolveStudentId(db, session.nationalCode);
  if (!studentId) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  let body: { courseId?: number; instructorId?: number | null; preferredDay?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  const result = await createNewCourseRequest(db, {
    studentId,
    courseId: Number(body.courseId),
    instructorId: body.instructorId ? Number(body.instructorId) : null,
    preferredDay: body.preferredDay ?? "",
    note: body.note ?? "",
  });

  if ("error" in result) return json({ success: false, message: result.error }, 422);

  await recordAuditEvent(db, {
    actor: { type: "student", id: studentId },
    action: "new_course_request.create",
    entityType: "new_course_request",
    entityId: result.id,
    metadata: { courseId: body.courseId },
  });

  return json({ success: true, id: result.id }, 201);
};
