export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, json, type InstructorEnv } from "../../../server/instructor-auth";
import { getInstructorTodayDashboard, listPendingAssignments } from "../../../server/instructor-portal";

export const GET: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);

  const db = env.DB;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ success: false, message: "تاریخ باید با فرمت YYYY-MM-DD باشد." }, 422);
  }

  try {
    const [dashboard, pendingAssignments] = await Promise.all([
      getInstructorTodayDashboard(db, session.instructorId, date),
      listPendingAssignments(db, session.instructorId),
    ]);
    return json({ success: true, date, ...dashboard, pendingAssignments });
  } catch (error) {
    console.error("[instructor/dashboard]", error);
    return json({ success: false, message: "دریافت داشبورد با خطا مواجه شد." }, 500);
  }
};
