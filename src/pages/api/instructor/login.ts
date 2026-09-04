export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { authenticateInstructor, createInstructorSessionResponse, json, type InstructorEnv } from "../../../server/instructor-auth";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const session = await authenticateInstructor(body.username ?? "", body.password ?? "", env as InstructorEnv);
    if (!session) return json({ success: false, message: "نام کاربری یا رمز عبور نادرست است." }, 401);
    return createInstructorSessionResponse(session);
  } catch {
    return json({ success: false, message: "ورود انجام نشد." }, 400);
  }
};
