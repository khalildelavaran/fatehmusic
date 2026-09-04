export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getInstructorSession, json, type InstructorEnv } from "../../../server/instructor-auth";
import { listInstructorClasses } from "../../../server/instructor-portal";

export const GET: APIRoute = async ({ request }) => {
  const session = await getInstructorSession(request, env as InstructorEnv);
  if (!session) return json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);

  const classes = await listInstructorClasses(env.DB, session.instructorId);
  return json({ success: true, classes });
};
