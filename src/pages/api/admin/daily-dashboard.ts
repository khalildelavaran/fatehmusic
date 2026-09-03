export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { listSessionsForDate } from "../../../server/class-sessions";
import { provisionEnrollmentSessionsForClassSession } from "../../../server/session-provisioning";

function persianWeekdayIndex(date: string): number {
  const value = new Date(`${date}T12:00:00Z`).getUTCDay();
  // JavaScript: Sunday=0..Saturday=6. Operational domain: Saturday=0..Friday=6.
  return (value + 1) % 7;
}

async function materializeScheduledSessions(db: D1Database, date: string): Promise<void> {
  const dayOfWeek = persianWeekdayIndex(date);
  const schedules = await db.prepare(`
    SELECT
      schedule.id AS schedule_id,
      schedule.class_id,
      schedule.start_time,
      schedule.end_time,
      schedule.room_id AS schedule_room_id,
      c.instructor_id,
      c.default_room_id,
      c.delivery_mode
    FROM class_schedules schedule
    JOIN classes c ON c.id = schedule.class_id
    WHERE schedule.day_of_week = ?
      AND schedule.status = 'active'
      AND c.status = 'active'
      AND (schedule.effective_from IS NULL OR schedule.effective_from <= ?)
      AND (schedule.effective_to IS NULL OR schedule.effective_to >= ?)
      AND (c.start_date IS NULL OR c.start_date <= ?)
      AND (c.end_date IS NULL OR c.end_date >= ?)
    ORDER BY schedule.start_time, schedule.id
  `).bind(dayOfWeek, date, date, date, date).all<{
    schedule_id: number;
    class_id: number;
    start_time: string;
    end_time: string;
    schedule_room_id: number | null;
    instructor_id: number;
    default_room_id: number | null;
    delivery_mode: string | null;
  }>();

  for (const schedule of schedules.results) {
    // A cancelled occurrence still represents this schedule/date. Do not
    // silently recreate it after the secretary explicitly cancelled it.
    const existing = await db.prepare(`
      SELECT id
      FROM class_sessions
      WHERE class_id = ?
        AND session_date = ?
        AND start_time = ?
      ORDER BY id DESC
      LIMIT 1
    `).bind(schedule.class_id, date, schedule.start_time).first<{ id: number }>();
    if (existing) continue;

    const locationType = schedule.delivery_mode === 'online' || schedule.delivery_mode === 'hybrid'
      ? schedule.delivery_mode
      : 'in_person';
    const roomId = schedule.schedule_room_id ?? schedule.default_room_id ?? null;

    const inserted = await db.prepare(`
      INSERT INTO class_sessions
        (class_id, session_date, start_time, end_time, instructor_id, room_id,
         location_type, type, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 'scheduled', ?)
    `).bind(
      schedule.class_id,
      date,
      schedule.start_time,
      schedule.end_time,
      schedule.instructor_id,
      roomId,
      locationType,
      `ایجاد خودکار از برنامه هفتگی #${schedule.schedule_id}`,
    ).run();

    if (typeof inserted.meta.last_row_id !== 'number') {
      throw new Error(`SESSION_CREATE_FAILED:${schedule.schedule_id}`);
    }
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;

    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ success: false, message: "تاریخ معتبر نیست." }, 422);
    }

    // Calendar exceptions are advisory. They are displayed below but never
    // suppress recurring session materialization automatically.
    await materializeScheduledSessions(db, date);

    const sessions = await listSessionsForDate(db, date);
    for (const session of sessions) {
      if (session.status === "cancelled") continue;
      try {
        await provisionEnrollmentSessionsForClassSession(db, session.id);
      } catch (error) {
        console.error(`[admin/daily-dashboard] provisioning failed for session ${session.id}:`, error);
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
        tsa.check_in_at AS teacher_check_in_at,
        ce.type AS calendar_exception_type,
        ce.title AS calendar_exception_title
      FROM class_sessions cs
      JOIN classes c ON c.id = cs.class_id
      LEFT JOIN rooms r ON r.id = cs.room_id
      LEFT JOIN instructors i ON i.id = cs.instructor_id
      LEFT JOIN teacher_session_attendance tsa
        ON tsa.session_id = cs.id AND tsa.instructor_id = cs.instructor_id
      LEFT JOIN calendar_exceptions ce
        ON ce.exception_date = cs.session_date
      WHERE cs.session_date = ?
      ORDER BY cs.start_time, cs.id
    `).bind(date).all<{
      id: number; class_id: number; session_date: string; start_time: string; end_time: string;
      instructor_id: number; room_id: number | null; location_type: string; type: string;
      status: string; original_session_id: number | null; class_title: string;
      room_name: string | null; instructor_name: string; teacher_attendance_status: string;
      teacher_check_in_at: string | null; calendar_exception_type: string | null;
      calendar_exception_title: string | null;
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
          et.tuition_due_date AS term_tuition_due_date,
          (
            SELECT COUNT(*)
            FROM enrollment_sessions consumed
            JOIN class_sessions consumed_session ON consumed_session.id = consumed.session_id
            WHERE consumed.enrollment_id = e.id
              AND consumed.enrollment_term_id = et.id
              AND consumed.status IN ('present', 'absent')
              AND consumed_session.status != 'cancelled'
          ) AS consumed_sessions,
          (
            SELECT MIN(inv.due_date)
            FROM invoices inv
            WHERE inv.enrollment_term_id = et.id
              AND inv.status IN ('pending', 'overdue')
          ) AS invoice_due_date,
          (
            SELECT inv.id
            FROM invoices inv
            WHERE inv.enrollment_term_id = et.id
              AND inv.status <> 'cancelled'
            ORDER BY inv.id DESC
            LIMIT 1
          ) AS invoice_id,
          (
            SELECT COALESCE(SUM(inv.amount), 0)
            FROM invoices inv
            WHERE inv.enrollment_term_id = et.id
              AND inv.status <> 'cancelled'
          ) AS invoice_amount,
          (
            SELECT COALESCE(SUM(p.amount), 0)
            FROM payments p
            JOIN invoices inv ON inv.id = p.invoice_id
            WHERE inv.enrollment_term_id = et.id
              AND inv.status <> 'cancelled'
          ) AS paid_amount
        FROM enrollment_sessions es
        JOIN enrollments e ON e.id = es.enrollment_id AND e.status = 'active'
        JOIN students s ON s.id = e.student_id
        LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
        WHERE es.session_id = ?
        ORDER BY s.last_name, s.first_name, es.id
      `).bind(session.id).all<{
        enrollment_session_id: number; enrollment_id: number; student_id: number;
        student_name: string; attendance_status: string; attendance_mode: string | null;
        note: string; term_id: number | null; planned_sessions: number | null;
        billing_type: string | null; consumed_sessions: number;
        term_tuition_due_date: string | null; invoice_due_date: string | null;
        invoice_id: number | null; invoice_amount: number | null; paid_amount: number | null;
      }>();

      result.push({
        ...session,
        students: students.results.map((student) => {
          const consumedSessions = student.consumed_sessions ?? 0;
          const remainingSessions =
            student.billing_type === 'monthly' || student.planned_sessions == null
              ? null
              : Math.max(student.planned_sessions - consumedSessions, 0);
          const tuitionDueDate = student.invoice_due_date ?? student.term_tuition_due_date;
          const invoiceAmount = Number(student.invoice_amount ?? 0);
          const paidAmount = Number(student.paid_amount ?? 0);
          const balance = Math.max(invoiceAmount - paidAmount, 0);
          const financialStatus = !student.invoice_id
            ? 'none'
            : balance <= 0
              ? 'paid'
              : tuitionDueDate && tuitionDueDate < date
                ? 'overdue'
                : paidAmount > 0
                  ? 'partial'
                  : 'pending';

          return {
            enrollmentSessionId: student.enrollment_session_id,
            enrollmentId: student.enrollment_id,
            studentId: student.student_id,
            studentName: student.student_name,
            attendanceStatus: student.attendance_status,
            attendanceMode: student.attendance_mode,
            note: student.note,
            termId: student.term_id,
            consumedSessions,
            plannedSessions: student.planned_sessions,
            remainingSessions,
            tuitionDueDate,
            tuitionWarning: tuitionDueDate != null || (remainingSessions != null && remainingSessions <= 1),
            invoiceId: student.invoice_id,
            invoiceAmount,
            paidAmount,
            balance,
            financialStatus,
          };
        }),
      });
    }

    return json({ success: true, date, sessions: result });
  } catch (error) {
    console.error("[admin/daily-dashboard] request failed:", error);
    return json({ success: false, message: "دریافت اطلاعات داشبورد روزانه با خطا مواجه شد." }, 500);
  }
};
