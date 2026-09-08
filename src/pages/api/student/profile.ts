export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";
import { validateStudentPatch, updateStudentProfile, type StudentProfilePatch } from "../../../server/students";

/**
 * Fields a student may edit about themselves. Deliberately excludes
 * `status` (lifecycle state -- admin/registrar only) and `notes`
 * (internal staff notes), which updateStudentProfile otherwise allows
 * for the admin-facing PATCH route.
 */
type SelfEditableField = "firstName" | "lastName" | "fatherName" | "birthYear" | "phone" | "email" | "address" | "idIssuePlace" | "occupation" | "emergencyContact";
const SELF_EDITABLE_FIELDS: SelfEditableField[] = ["firstName", "lastName", "fatherName", "birthYear", "phone", "email", "address", "idIssuePlace", "occupation", "emergencyContact"];

async function resolveStudent(db: D1Database, nationalCode: string) {
  return db
    .prepare(
      "SELECT id, national_code, first_name, last_name, father_name, birth_year, phone, email, address, id_issue_place, occupation, emergency_contact, status FROM students WHERE national_code = ?",
    )
    .bind(nationalCode)
    .first<{
      id: number; national_code: string; first_name: string; last_name: string; father_name: string;
      birth_year: number | null; phone: string; email: string; address: string; id_issue_place: string;
      occupation: string; emergency_contact: string; status: string;
    }>();
}

export const GET: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;

  const student = await resolveStudent(db, session.nationalCode);
  if (!student) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  return json({
    success: true,
    profile: {
      nationalCode: student.national_code,
      firstName: student.first_name,
      lastName: student.last_name,
      fatherName: student.father_name,
      birthYear: student.birth_year,
      phone: student.phone,
      email: student.email,
      address: student.address,
      idIssuePlace: student.id_issue_place,
      occupation: student.occupation,
      emergencyContact: student.emergency_contact,
      status: student.status,
    },
  });
};

export const PATCH: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;

  const student = await resolveStudent(db, session.nationalCode);
  if (!student) return json({ success: false, message: "پروفایل هنرجو یافت نشد." }, 404);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "بدنه‌ی درخواست معتبر نیست." }, 400);
  }

  // Only forward fields the student is allowed to touch; anything else
  // in the request body (e.g. status, notes) is silently ignored
  // rather than erroring, so a stray extra field in the client never
  // becomes an authorization bypass.
  const patch: StudentProfilePatch = {};
  for (const field of SELF_EDITABLE_FIELDS) {
    if (body[field] !== undefined) (patch as Record<string, unknown>)[field] = body[field];
  }

  const validation = validateStudentPatch(patch);
  if (!validation.valid) return json({ success: false, message: validation.errors.join(" ") }, 422);

  const ok = await updateStudentProfile(db, student.id, patch);
  if (!ok) return json({ success: false, message: "به‌روزرسانی پروفایل انجام نشد." }, 500);

  const updated = await resolveStudent(db, session.nationalCode);
  return json({
    success: true,
    profile: updated && {
      nationalCode: updated.national_code,
      firstName: updated.first_name,
      lastName: updated.last_name,
      fatherName: updated.father_name,
      birthYear: updated.birth_year,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      idIssuePlace: updated.id_issue_place,
      occupation: updated.occupation,
      emergencyContact: updated.emergency_contact,
      status: updated.status,
    },
  });
};
