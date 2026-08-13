import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { clearSessionCookie, json, logoutAdmin, type AdminEnv } from "../../../server/admin-auth";

export const POST: APIRoute = async ({ request }) => {
  const runtimeEnv = env as AdminEnv;
  await logoutAdmin(request, runtimeEnv);
  return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie() });
};
