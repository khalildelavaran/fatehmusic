import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { authenticateAdmin, createSessionResponse, json, type AdminEnv } from "../../../server/admin-auth";

export const POST: APIRoute = async ({ request }) => {
  const runtimeEnv = env as AdminEnv;
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "درخواست نامعتبر است." }, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return json({ success: false, message: "نام کاربری و رمز عبور الزامی است." }, 400);
console.log("LOGIN DEBUG START", {
  username,
  hasPassword: Boolean(password),
  length: password.length
});
  const session = await authenticateAdmin(username, password, runtimeEnv);
  console.log("LOGIN DEBUG RESULT", Boolean(session));
  if (!session) return json({ success: false, message: "نام کاربری یا رمز عبور نادرست است." }, 401);
  return createSessionResponse(session as typeof session & { token: string });
};
