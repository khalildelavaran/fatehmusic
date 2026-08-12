export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, loginAdmin, sessionCookie } from "../../../server/admin-auth";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = body.username ?? "";
    const password = body.password ?? "";

    const result = await loginAdmin(env, username, password);
    if (!result) return json({ success: false, message: "نام کاربری یا رمز عبور نادرست است." }, 401);

    return json(
      { success: true, username: result.username, role: result.role },
      200,
      { "Set-Cookie": sessionCookie(result.sessionId) }
    );
  } catch {
    return json({ success: false, message: "درخواست ورود معتبر نیست." }, 400);
  }
};
