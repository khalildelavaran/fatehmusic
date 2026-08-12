import type { APIRoute } from "astro";
import { clearSessionCookie, json, logoutAdmin, type AdminEnv } from "../../../server/admin-auth";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as AdminEnv;
  await logoutAdmin(request, env);
  return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie() });
};
