export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, json, type StudentEnv } from "../../../server/student-auth";

/**
 * Bridges the legacy registrations-based student session (identified
 * by national_code) to the newer enrollments domain model, which is
 * what evaluations/assignments/attendance/makeup-requests are all
 * keyed on. See CLAUDE.md / .agents/skills/music-school-domain for
 * why these are two separate tables rather than one.
 */
export const GET: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = (env as StudentEnv).DB;

  const student = await db.prepare("SELECT id FROM students WHERE national_code = ?").bind(session.nationalCode).first<{ id: number }>();
  if (!student) return json({ success: true, enrollments: [] });

  const rows = await db
    .prepare(
      `SELECT e.id AS enrollment_id, e.class_id, e.status, c.title AS class_title,
              TRIM(i.first_name || ' ' || i.last_name) AS instructor_name
       FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       JOIN instructors i ON i.id = c.instructor_id
       WHERE e.student_id = ?
       ORDER BY e.status = 'active' DESC, e.created_at DESC`,
    )
    .bind(student.id)
    .all();

  const enrollments = (rows.results ?? []).map((row: any) => ({
    enrollmentId: Number(row.enrollment_id),
    classId: Number(row.class_id),
    classTitle: String(row.class_title || ""),
    instructorName: String(row.instructor_name || ""),
    status: String(row.status || ""),
  }));

  return json({ success: true, enrollments });
};
