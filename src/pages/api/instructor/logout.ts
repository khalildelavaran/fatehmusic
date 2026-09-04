export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { clearInstructorCookie, logoutInstructor, json, type InstructorEnv } from "../../../server/instructor-auth";

export const POST: APIRoute = async ({ request }) => {
  await logoutInstructor(request, env as InstructorEnv);
  return json({ success: true }, 200, { "Set-Cookie": clearInstructorCookie() });
};
