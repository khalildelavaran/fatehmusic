export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listSessionsForDate } from "../../../server/class-sessions";
import { provisionEnrollmentSessionsForClassSession } from "../../../server/session-provisioning";

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;

  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ success: false, message: "تاریخ معتبر نیست." }, 422);
  }

  const sessions = await listSessionsForDate(db, date);
  for (const session of sessions) {
    if (session.status !== "cancelled") {
      await provisionEnrollmentSessionsForClassSession(db, session.id);
    }
  }

  const sessionRows = await db.prepare(`
    SELECT
      cs.id,
      cs.class_id,
      cs.session_date,
      cs.start_time,
      cs.end_time,
      cs.instructor_id,
      cs.room_id,
      cs.location_type,
      cs.type,
      cs.status,
      cs.original_session_id,
      c.title AS class_title,
      r.name AS room_name,
      TRIM(COALESCE(i.first_name, '') || ' ' || COALESCE(i.last_name, '')) AS instructor_name,
      COALESCE(tsa.status, 'pending') AS teacher_attendance_status,
      tsa.check_in_at AS teacher_check_in_at
    FROM class_sessions cs
    JOIN classes c ON c.id = cs.class_id
    LEFT JOIN rooms r ON r.id = cs.room_id
    LEFT JOIN instructors i ON i.id = cs.instructor_id
    LEFT JOIN teacher_session_attendance tsa
      ON tsa.session_id = cs.id AND tsa.instructor_id = cs.instructor_id
    WHERE cs.session_date = ?
    ORDER BY cs.start_time, cs.id
  `).bind(date).all<{
    id: number; class_id: number; session_date: string; start_time: string; end_time: string;
    instructor_id: number; room_id: number | null; location_type: string; type: string;
    status: string; original_session_id: number | null; class_title: string;
    room_name: string | null; instructor_name: string; teacher_attendance_status: string;
    teacher_check_in_at: string | null;
  }>();

  const result = [];
  for (const session of sessionRows.results) {
    const students = await db.prepare(`
      SELECT
        es.id AS enrollment_session_id,
        e.id AS enrollment_id,
        e.student_id,
        TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS student_name,
        es.status AS attendance_status,
        es.attendance_mode,
        es.note,
        et.id AS term_id,
        et.planned_sessions,
        et.billing_type,
        (
          SELECT COUNT(*) FROM enrollment_sessions consumed
          WHERE consumed.enrollment_id = e.id
            AND consumed.enrollment_term_id = et.id
            AND consumed.status IN ('present', 'absent')
        ) AS consumed_sessions,
        (
          SELECT MIN(i.due_date) FROM invoices i
          WHERE i.enrollment_term_id = et.id
            AND i.status IN ('pending', 'overdue')
        ) AS tuition_due_date
      FROM enrollment_sessions es
      JOIN enrollments e ON e.id = es.enrollment_id AND e.status = 'active'
      JOIN students s ON s.id = e.student_id
      LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
      WHERE es.session_id = ?
      ORDER BY student_name, es.id
    `).bind(session.id).all<{
      enrollment_session_id: number; enrollment_id: number; student_id: number;
      student_name: string; attendance_status: string; attendance_mode: string | null;
      note: string; term_id: number | null; planned_sessions: number | null;
      billing_type: string | null; consumed_sessions: number; tuition_due_date: string | null;
    }>();

    result.push({
      ...session,
      students: students.results.map((student) => ({
        enrollmentSessionId: student.enrollment_session_id,
        enrollmentId: student.enrollment_id,
        studentId: student.student_id,
        studentName: student.student_name,
        attendanceStatus: student.attendance_status,
        attendanceMode: student.attendance_mode,
        note: student.note,
        termId: student.term_id,
        consumedSessions: student.consumed_sessions ?? 0,
        plannedSessions: student.planned_sessions,
        remainingSessions:
          student.billing_type === 'monthly' || student.planned_sessions == null
            ? null
            : Math.max(student.planned_sessions - (student.consumed_sessions ?? 0), 0),
        tuitionDueDate: student.tuition_due_date,
        tuitionWarning: student.tuition_due_date != null ||
          (student.planned_sessions != null &&
            student.planned_sessions - (student.consumed_sessions ?? 0) <= 1),
      })),
    });
  }

  return json({ success: true, date, sessions: result });
};
