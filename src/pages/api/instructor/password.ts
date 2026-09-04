export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, changeInstructorPassword, json, type InstructorEnv } from "../../../server/instructor-auth";

export const POST: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
  try {
    const body = await request.json() as { new_password?: string };
    const password = (body.new_password ?? "").trim();
    if (password.length < 8) return json({ success: false, message: "رمز جدید باید حداقل ۸ کاراکتر باشد." }, 422);
    const ok = await changeInstructorPassword(session.accountId, password, env as InstructorEnv);
    if (!ok) return json({ success: false, message: "تغییر رمز انجام نشد." }, 500);
    return json({ success: true, message: "رمز عبور با موفقیت تغییر کرد." });
  } catch {
    return json({ success: false, message: "تغییر رمز انجام نشد." }, 400);
  }
};
