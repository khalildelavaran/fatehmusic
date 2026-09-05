export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";
import { listNotifications, markNotificationRead, markAllNotificationsRead, countUnreadNotifications } from "../../../server/in-app-notifications";

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

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "1";

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(db, { recipientType: "student", recipientId: studentId, unreadOnly }),
    countUnreadNotifications(db, "student", studentId),
  ]);

  return json({ success: true, notifications, unreadCount });
};

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;
  const studentId = await resolveStudentId(db, session.nationalCode);
  if (!studentId) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  let body: { id?: number; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  if (body.markAllRead) {
    const count = await markAllNotificationsRead(db, "student", studentId);
    return json({ success: true, updated: count });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه اعلان معتبر نیست." }, 422);
  const updated = await markNotificationRead(db, id, "student", studentId);
  return json({ success: updated });
};
