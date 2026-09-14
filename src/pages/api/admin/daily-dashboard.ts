export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { calculateFinance } from "../../../server/finance-calculations";
import { listActiveRooms } from "../../../server/rooms";

function persianWeekdayIndex(date: string): number {
  const value = new Date(`${date}T12:00:00Z`).getUTCDay();
  return (value + 1) % 7;
}

/**
 * Materialize the day's recurring sessions with one set-based INSERT.
 * The old implementation performed one SELECT + INSERT per schedule.
 */
async function materializeScheduledSessions(db: D1Database, date: string): Promise<void> {
  const dayOfWeek = persianWeekdayIndex(date);
  await db.prepare(`
    INSERT INTO class_sessions (
      class_id, session_date, start_time, end_time, instructor_id, room_id,
      location_type, type, status, notes, source_schedule_id
    )
    SELECT
      cs.class_id,
      ?,
      cs.start_time,
      cs.end_time,
      c.instructor_id,
      COALESCE(cs.room_id, c.default_room_id),
      CASE WHEN c.delivery_mode IN ('online', 'hybrid') THEN c.delivery_mode ELSE 'in_person' END,
      'regular',
      'scheduled',
      'ایجاد خودکار از برنامه هفتگی #' || cs.id,
      cs.id
    FROM class_schedules cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.day_of_week = ?
      AND cs.status = 'active'
      AND c.status = 'active'
      AND (cs.effective_from IS NULL OR cs.effective_from <= ?)
      AND (cs.effective_to IS NULL OR cs.effective_to >= ?)
      AND (c.start_date IS NULL OR c.start_date <= ?)
      AND (c.end_date IS NULL OR c.end_date >= ?)
      AND NOT EXISTS (
        SELECT 1
        FROM class_sessions existing
        WHERE existing.source_schedule_id = cs.id
          AND existing.session_date = ?
          AND existing.status <> 'cancelled'
      )
  `).bind(dayOfWeek, dayOfWeek, date, date, date, date, date).run();
}

/**
 * Ensure attendance rows exist for all active enrollments of the selected
 * day's sessions in one set-based statement. A missing term never blocks
 * attendance; the term link is nullable by design.
 */
async function provisionDailyEnrollmentSessions(db: D1Database, date: string): Promise<void> {
  await db.prepare(`
    INSERT INTO enrollment_sessions (
      enrollment_id, session_id, enrollment_term_id, status, attendance_mode, note
    )
    SELECT
      e.id,
      cs.id,
      (
        SELECT et.id
        FROM enrollment_terms et
        WHERE et.enrollment_id = e.id
          AND et.status = 'active'
        ORDER BY et.term_number DESC, et.id DESC
        LIMIT 1
      ),
      'pending',
      CASE WHEN cs.location_type = 'online' THEN 'online' ELSE 'in_person' END,
      'ایجاد خودکار برای داشبورد روزانه'
    FROM class_sessions cs
    JOIN enrollments e
      ON e.class_id = cs.class_id
     AND e.status = 'active'
    WHERE cs.session_date = ?
      AND cs.status <> 'cancelled'
      AND NOT EXISTS (
        SELECT 1
        FROM enrollment_sessions existing
        WHERE existing.enrollment_id = e.id
          AND existing.session_id = cs.id
      )
  `).bind(date).run();
}

export const GET: APIRoute = async ({ request }) => {
  let stage = "start";
  try {
    stage = "auth";
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;

    stage = "database";
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    stage = "date";
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

    stage = "materialize";
    await materializeScheduledSessions(db, date);

    stage = "provision";
    await provisionDailyEnrollmentSessions(db, date);

    stage = "session-query";
    const sessionRows = await db.prepare(`
      SELECT cs.id, cs.class_id, cs.session_date, cs.start_time, cs.end_time,
        cs.instructor_id, cs.room_id, cs.location_type, cs.type, cs.status, cs.original_session_id, cs.notes,
        c.title AS class_title, r.name AS room_name,
        TRIM(COALESCE(i.first_name, '') || ' ' || COALESCE(i.last_name, '')) AS instructor_name,
        COALESCE(tsa.status, 'pending') AS teacher_attendance_status,
        tsa.check_in_at AS teacher_check_in_at,
        ce.type AS calendar_exception_type, ce.title AS calendar_exception_title
      FROM class_sessions cs
      JOIN classes c ON c.id = cs.class_id
      LEFT JOIN rooms r ON r.id = cs.room_id
      LEFT JOIN instructors i ON i.id = cs.instructor_id
      LEFT JOIN teacher_session_attendance tsa ON tsa.session_id = cs.id AND tsa.instructor_id = cs.instructor_id
      LEFT JOIN calendar_exceptions ce ON ce.exception_date = cs.session_date
      WHERE cs.session_date = ?
      ORDER BY cs.start_time, cs.id
    `).bind(date).all<{
      id: number; class_id: number; session_date: string; start_time: string; end_time: string;
      instructor_id: number; room_id: number | null; location_type: string; type: string;
      status: string; original_session_id: number | null; notes: string; class_title: string;
      room_name: string | null; instructor_name: string; teacher_attendance_status: string;
      teacher_check_in_at: string | null; calendar_exception_type: string | null; calendar_exception_title: string | null;
    }>();

    const result = [];
    for (const session of sessionRows.results) {
      stage = `student-query:${session.id}`;
      const students = await db.prepare(`
        SELECT
          es.id AS enrollment_session_id, e.id AS enrollment_id, e.student_id,
          TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS student_name,
          es.status AS attendance_status, es.attendance_mode, es.note,
          et.id AS term_id, et.term_number, et.planned_sessions, et.billing_type,
          et.tuition_amount AS term_tuition_amount, et.tuition_due_date AS term_tuition_due_date,
          (
            SELECT COUNT(*) FROM enrollment_sessions consumed
            WHERE consumed.enrollment_id = e.id AND consumed.enrollment_term_id = et.id
              AND consumed.status IN ('present', 'absent')
          ) AS consumed_sessions,
          (
            SELECT i.id FROM invoices i
            WHERE i.enrollment_term_id = et.id AND i.status <> 'cancelled'
            ORDER BY i.id DESC LIMIT 1
          ) AS invoice_id,
          (
            SELECT i.amount FROM invoices i
            WHERE i.enrollment_term_id = et.id AND i.status <> 'cancelled'
            ORDER BY i.id DESC LIMIT 1
          ) AS invoice_amount,
          (
            SELECT i.due_date FROM invoices i
            WHERE i.enrollment_term_id = et.id AND i.status <> 'cancelled'
            ORDER BY i.id DESC LIMIT 1
          ) AS invoice_due_date,
          (
            SELECT COALESCE(SUM(p.amount), 0) FROM payments p
            WHERE p.invoice_id = (
              SELECT i.id FROM invoices i
              WHERE i.enrollment_term_id = et.id AND i.status <> 'cancelled'
              ORDER BY i.id DESC LIMIT 1
            )
          ) AS paid_amount
        FROM enrollment_sessions es
        JOIN enrollments e ON e.id = es.enrollment_id AND e.status = 'active'
        JOIN students s ON s.id = e.student_id
        LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
        WHERE es.session_id = ?
        ORDER BY s.last_name, s.first_name, es.id
      `).bind(session.id).all<{
        enrollment_session_id: number; enrollment_id: number; student_id: number; student_name: string;
        attendance_status: string; attendance_mode: string | null; note: string;
        term_id: number | null; term_number: number | null; planned_sessions: number | null;
        billing_type: string | null; consumed_sessions: number;
        term_tuition_amount: number | null; term_tuition_due_date: string | null;
        invoice_id: number | null; invoice_amount: number | null; invoice_due_date: string | null; paid_amount: number | null;
      }>();

      stage = `student-map:${session.id}`;
      result.push({
        ...session,
        startTime: session.start_time,
        endTime: session.end_time,
        student_names: students.results.map((student) => student.student_name).join("، "),
        course_names: session.class_title,
        students: students.results.map((student) => {
          const consumedSessions = student.consumed_sessions ?? 0;
          const remainingSessions = student.billing_type === "monthly" || student.planned_sessions == null
            ? null : student.planned_sessions - consumedSessions;
          const renewalReady = student.billing_type === "monthly"
            ? true
            : student.planned_sessions != null && remainingSessions != null && remainingSessions <= 1;
          const tuitionDueDate = student.invoice_due_date ?? student.term_tuition_due_date;
          const finance = calculateFinance({
            invoiceAmount: Number(student.invoice_amount ?? student.term_tuition_amount ?? 0),
            paidAmount: Number(student.paid_amount ?? 0),
            dueDate: tuitionDueDate,
            today: date,
            billingType: student.billing_type,
            plannedSessions: student.planned_sessions,
            consumedSessions,
          });
          const financialStatus = student.invoice_id ? finance.financialStatus : "none";
          return {
            enrollmentSessionId: student.enrollment_session_id,
            enrollmentId: student.enrollment_id,
            studentId: student.student_id,
            studentName: student.student_name,
            attendanceStatus: student.attendance_status,
            attendanceMode: student.attendance_mode,
            note: student.note,
            termId: student.term_id,
            termNumber: student.term_number,
            consumedSessions,
            plannedSessions: student.planned_sessions,
            remainingSessions,
            renewalReady,
            tuitionDueDate,
            tuitionWarning: finance.overdue || finance.nearDue || renewalReady,
            invoiceId: student.invoice_id,
            invoiceAmount: finance.invoiceAmount,
            paidAmount: finance.paidAmount,
            amountDueToDate: finance.amountDueToDate,
            balance: finance.balance,
            balanceToDate: finance.balanceToDate,
            unpaidSessions: finance.unpaidSessions,
            overdue: finance.overdue,
            nearDue: finance.nearDue,
            financialStatus,
          };
        }),
      });
    }

    stage = "rooms";
    const rooms = await listActiveRooms(db);

    stage = "response";
    return json({ success: true, date, sessions: result, rooms });
  } catch (error) {
    console.error("[admin/daily-dashboard] request failed:", { stage, error });
    const detail = error instanceof Error ? error.message : String(error);
    return json({
      success: false,
      message: `دریافت اطلاعات داشبورد روزانه با خطا مواجه شد. [${stage}] ${detail}`,
    }, 500);
  }
};
