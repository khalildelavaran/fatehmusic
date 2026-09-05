export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, json, type InstructorEnv } from "../../../server/instructor-auth";
import { listNotifications, markNotificationRead, markAllNotificationsRead, countUnreadNotifications } from "../../../server/in-app-notifications";

export const GET: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
  const db = env.DB;

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "1";

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(db, { recipientType: "instructor", recipientId: session.instructorId, unreadOnly }),
    countUnreadNotifications(db, "instructor", session.instructorId),
  ]);

  return json({ success: true, notifications, unreadCount });
};

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
  const db = env.DB;

  let body: { id?: number; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه درخواست معتبر نیست." }, 400);
  }

  if (body.markAllRead) {
    const count = await markAllNotificationsRead(db, "instructor", session.instructorId);
    return json({ success: true, updated: count });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه اعلان معتبر نیست." }, 422);
  const updated = await markNotificationRead(db, id, "instructor", session.instructorId);
  return json({ success: updated });
};
