export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createAdminSession, hashPassword, json, verifyPassword, ADMIN_SESSION_COOKIE, SESSION_TTL_SECONDS } from "../../../server/admin-auth";

export const POST: APIRoute = async ({ request }) => {
  const db = env.DB;
  const sessionStore = env.SESSION;
  if (!db || !sessionStore) {
    return json({ success: false, message: "سرویس احراز هویت روی سرور آماده نیست." }, 503);
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "درخواست ورود معتبر نیست." }, 400);
  }

  const username = body.username?.trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return json({ success: false, message: "نام کاربری و رمز عبور الزامی است." }, 422);
  }

  const user = await db.prepare(
    "SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username = ? LIMIT 1"
  ).bind(username).first<{
    id: number;
    username: string;
    password_hash: string;
    role: string;
    is_active: number;
  }>();

  if (!user || user.is_active !== 1 || !(await verifyPassword(password, user.password_hash))) {
    return json({ success: false, message: "نام کاربری یا رمز عبور نادرست است." }, 401);
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await sessionStore.put(
    `admin:${sessionId}`,
    JSON.stringify({ userId: user.id, username: user.username, role: user.role, expiresAt }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  return new Response(JSON.stringify({ success: true, username: user.username, role: user.role }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `${ADMIN_SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
      "Cache-Control": "no-store"
    }
  });
};

void hashPassword;
