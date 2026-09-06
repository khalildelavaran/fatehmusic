export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { authenticateAdmin, createSessionResponse, json as adminJson, type AdminEnv } from "../../server/admin-auth";
import { authenticateInstructor, createInstructorSessionResponse, type InstructorEnv } from "../../server/instructor-auth";
import { authenticateStudent, createStudentSessionResponse, type StudentEnv } from "../../server/student-auth";
import { looksLikeNationalCode } from "../../server/unified-login";

/**
 * Unified login: a single identifier+password pair is tried against
 * each of the four existing, unmodified auth systems (admin/registrar,
 * instructor, student) in turn, and the first successful match wins.
 * This intentionally does not merge or touch admin_users,
 * instructor_accounts, or student_accounts -- each keeps its own table,
 * password hashing, session cookie, and KV prefix exactly as before;
 * this endpoint is purely a routing layer in front of them.
 *
 * Order matters for correctness, not just preference: a 10-digit
 * national code is checked as a student login first since it is a
 * strong, unambiguous signal (no admin/instructor login value can also
 * be a valid national code shape by construction elsewhere in the
 * app). Otherwise, admin/registrar is tried before instructor as the
 * lower-privilege-surface, less sensitive system to probe first.
 *
 * On failure, the same generic message is returned regardless of which
 * system(s) were tried, so a wrong password never reveals which role a
 * given identifier belongs to.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { identifier?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return adminJson({ success: false, message: "درخواست نامعتبر است." }, 400);
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return adminJson({ success: false, message: "نام کاربری/کد ملی و رمز عبور الزامی است." }, 400);
  }

  const isNationalCode = looksLikeNationalCode(identifier);

  if (isNationalCode) {
    const studentSession = await authenticateStudent(identifier, password, env as StudentEnv);
    if (studentSession) {
      const response = createStudentSessionResponse(studentSession);
      const data = (await response.clone().json()) as { user: unknown };
      return adminJson({ success: true, role: "student", redirect: "/student", user: data.user }, 200, {
        "Set-Cookie": response.headers.get("Set-Cookie") ?? "",
      });
    }
    // A 10-digit identifier is unambiguously a student login attempt;
    // do not also probe admin/instructor tables with it.
    return adminJson({ success: false, message: "کد ملی یا رمز عبور نادرست است." }, 401);
  }

  const adminSession = await authenticateAdmin(identifier, password, env as AdminEnv);
  if (adminSession) {
    const response = createSessionResponse(adminSession as typeof adminSession & { token: string });
    const data = (await response.clone().json()) as { user: unknown };
    const role = adminSession.role === "registrar" ? "registrar" : "admin";
    return adminJson({ success: true, role, redirect: "/admin", user: data.user }, 200, {
      "Set-Cookie": response.headers.get("Set-Cookie") ?? "",
    });
  }

  const instructorSession = await authenticateInstructor(identifier, password, env as InstructorEnv);
  if (instructorSession) {
    const response = createInstructorSessionResponse(instructorSession);
    const data = (await response.clone().json()) as { user: unknown };
    return adminJson({ success: true, role: "instructor", redirect: "/instructor", user: data.user }, 200, {
      "Set-Cookie": response.headers.get("Set-Cookie") ?? "",
    });
  }

  return adminJson({ success: false, message: "نام کاربری یا رمز عبور نادرست است." }, 401);
};
