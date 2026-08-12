export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { ADMIN_SESSION_COOKIE, destroyAdminSession, json } from "../../../server/admin-auth";

export const POST: APIRoute = async ({ request }) => {
  await destroyAdminSession(request, env);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      "Cache-Control": "no-store"
    }
  });
};

export const GET: APIRoute = async () => json({ success: false, message: "از POST برای خروج استفاده کنید." }, 405);
