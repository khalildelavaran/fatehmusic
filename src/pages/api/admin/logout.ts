export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { clearSessionCookie, json, logoutAdmin } from "../../../server/admin-auth";

export const POST: APIRoute = async ({ request }) => {
  await logoutAdmin(request, env);
  return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie() });
};
