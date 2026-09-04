export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, json, type InstructorEnv } from "../../../server/instructor-auth";
import { getInstructorProfile } from "../../../server/instructor-portal";

export const GET: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);

  const db = env.DB;
  const account = await db
    .prepare("SELECT must_change_password FROM instructor_accounts WHERE id = ?")
    .bind(session.accountId)
    .first<{ must_change_password: number }>();

  const profile = await getInstructorProfile(db, session.instructorId, account?.must_change_password === 1);
  if (!profile) return json({ success: false, message: "پروفایل مدرس یافت نشد." }, 404);
  return json({ success: true, instructor: profile });
};
