export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireInstructor, type InstructorEnv } from "../../../server/instructor-auth";
import { provisionEnrollmentSessionsForClassSession } from "../../../server/session-provisioning";
import { calculateFinance, calculateInstructorShare } from "../../../server/finance-calculations";

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const startDate = `${month}-01`;
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return { startDate, endDate: next.toISOString().slice(0, 10) };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const auth = await requireInstructor(request, env as InstructorEnv);
    if (auth instanceof Response) return auth;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const bounds = monthBounds(month);
    if (!bounds) return json({ success: false, message: "ماه معتبر نیست." }, 422);
    const { startDate, endDate } = bounds;

    const sessionIds = await db.prepare(`
      SELECT id FROM class_sessions
      WHERE instructor_id = ? AND session_date >= ? AND session_date < ? AND status <> 'cancelled'
      ORDER BY session_date, start_time, id
    `).bind(auth.instructorId, startDate, endDate).all<{ id: number }>();
    for (const row of sessionIds.results) {
      try { await provisionEnrollmentSessionsForClassSession(db, row.id); }
      catch (error) { console.warn(`[instructor/finance] session ${row.id} provisioning skipped:`, error); }
    }

    const instructor = await db.prepare(`SELECT id, first_name, last_name, pay_percentage FROM instructors WHERE id = ? LIMIT 1`)
      .bind(auth.instructorId).first<{ id: number; first_name: string; last_name: string; pay_percentage: number | null }>();
    const payPercentage = Math.min(100, Math.max(0, Number(instructor?.pay_percentage ?? 50)));

    const rows = await db.prepare(`
      SELECT
        cs.id AS session_id, cs.session_date, cs.start_time, cs.end_time, cs.status AS session_status,
        c.title AS class_title,
        es.id AS enrollment_session_id, es.status AS attendance_status,
        e.id AS enrollment_id, e.student_id,
        TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS student_name,
        et.id AS term_id, et.billing_type, et.tuition_amount, et.planned_sessions,
        COALESCE((SELECT COUNT(*) FROM enrollment_sessions es2
          JOIN class_sessions cs2 ON cs2.id = es2.session_id
          WHERE es2.enrollment_id = e.id AND es2.enrollment_term_id = et.id
            AND cs2.session_date < ? AND cs2.status <> 'cancelled'
            AND es2.status IN ('present', 'absent')), 0) AS prior_compensable_sessions,
        i.id AS invoice_id, i.amount AS invoice_amount, i.due_date, i.status AS invoice_status,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
      FROM class_sessions cs
      JOIN enrollment_sessions es ON es.session_id = cs.id
      JOIN enrollments e ON e.id = es.enrollment_id AND e.class_id = cs.class_id
      JOIN students s ON s.id = e.student_id
      LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
      LEFT JOIN invoices i ON i.id = (
        SELECT i2.id FROM invoices i2
        WHERE i2.enrollment_term_id = et.id AND i2.status <> 'cancelled'
        ORDER BY i2.id DESC LIMIT 1
      )
      WHERE cs.instructor_id = ?
        AND cs.session_date >= ? AND cs.session_date < ?
        AND cs.status <> 'cancelled'
      ORDER BY cs.session_date ASC, cs.start_time ASC, student_name, cs.id
    `).bind(startDate, auth.instructorId, startDate, endDate).all<{
      session_id: number; session_date: string; start_time: string; end_time: string; session_status: string;
      class_title: string | null; enrollment_session_id: number; attendance_status: string;
      enrollment_id: number; student_id: number; student_name: string; term_id: number | null;
      billing_type: string | null; tuition_amount: number | null; planned_sessions: number | null;
      prior_compensable_sessions: number; invoice_id: number | null; invoice_amount: number | null;
      due_date: string | null; invoice_status: string | null; paid_amount: number;
    }>();

    const details = rows.results.map((row) => ({
      ...row,
      sessionValue: row.attendance_status === "present" || row.attendance_status === "absent"
        ? row.billing_type === "session_based" && row.tuition_amount != null && row.planned_sessions && row.planned_sessions > 0
          ? Number(row.tuition_amount) / Number(row.planned_sessions) : 0
        : 0,
      instructorShare: 0,
      compensable: row.attendance_status === "present" || row.attendance_status === "absent",
      amountDueToDate: 0,
      balance: 0,
      paymentStatus: row.invoice_id ? row.invoice_status : "unknown",
    }));

    const groups = new Map<string, typeof details>();
    for (const row of details) {
      const key = `${row.enrollment_id}:${row.term_id ?? 0}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      let compensableCount = Number(group[0]?.prior_compensable_sessions ?? 0);
      for (const row of group) {
        if (row.compensable) compensableCount += 1;
        const rawSessionValue = Number(row.sessionValue);
        const finance = calculateFinance({
          invoiceAmount: Number(row.invoice_amount ?? row.tuition_amount ?? 0),
          paidAmount: Number(row.paid_amount ?? 0),
          dueDate: row.due_date,
          billingType: row.billing_type,
          plannedSessions: row.planned_sessions,
          consumedSessions: compensableCount,
        });
        row.amountDueToDate = finance.amountDueToDate;
        row.balance = finance.balance;
        row.instructorShare = calculateInstructorShare(rawSessionValue, payPercentage);
        row.paymentStatus = row.invoice_id ? finance.financialStatus : "unknown";
      }
    }

    const paymentRows = await db.prepare(`
      SELECT p.id,p.amount,p.paid_at,p.method,p.reference,p.note,i.id AS invoice_id,i.amount AS invoice_amount,
        et.id AS term_id,e.id AS enrollment_id,s.id AS student_id,
        TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')) AS student_name,c.title AS class_title
      FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN enrollment_terms et ON et.id=i.enrollment_term_id
      JOIN enrollments e ON e.id=et.enrollment_id JOIN students s ON s.id=e.student_id LEFT JOIN classes c ON c.id=e.class_id
      WHERE date(p.paid_at) >= ? AND date(p.paid_at) < ?
        AND EXISTS (SELECT 1 FROM enrollment_sessions es JOIN class_sessions cs ON cs.id=es.session_id
          WHERE es.enrollment_id=e.id AND cs.instructor_id=?)
      ORDER BY p.paid_at DESC,p.id DESC
    `).bind(startDate,endDate,auth.instructorId).all();

    const priorDebt = await db.prepare(`
      SELECT i.id AS invoice_id,i.amount AS invoice_amount,i.due_date,i.status,e.id AS enrollment_id,s.id AS student_id,
        TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')) AS student_name,c.title AS class_title,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid_amount
      FROM invoices i JOIN enrollment_terms et ON et.id=i.enrollment_term_id JOIN enrollments e ON e.id=et.enrollment_id
      JOIN students s ON s.id=e.student_id LEFT JOIN classes c ON c.id=e.class_id
      WHERE i.status <> 'cancelled' AND i.due_date IS NOT NULL AND i.due_date < ?
        AND COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) < i.amount
        AND EXISTS (SELECT 1 FROM enrollment_sessions es JOIN class_sessions cs ON cs.id=es.session_id
          WHERE es.enrollment_id=e.id AND cs.instructor_id=? AND cs.session_date < ?)
      ORDER BY i.due_date ASC,i.id ASC
    `).bind(startDate,auth.instructorId,startDate).all();

    const balanceByGroup = new Map<string, number>();
    for (const row of details) {
      const key = `${row.enrollment_id}:${row.term_id ?? 0}`;
      balanceByGroup.set(key, Math.max(balanceByGroup.get(key) ?? 0, Number(row.balance)));
    }

    const totals = {
      sessions: new Set(details.map((x) => x.session_id)).size,
      studentSessions: details.length,
      compensableSessions: details.filter((x) => x.compensable).length,
      sessionValue: details.reduce((sum, x) => sum + Number(x.sessionValue), 0),
      instructorShare: details.reduce((sum, x) => sum + Number(x.instructorShare), 0),
      currentPayments: paymentRows.results.reduce((sum, x) => sum + Number(x.amount), 0),
      currentOutstanding: [...balanceByGroup.values()].reduce((sum, value) => sum + value, 0),
      priorMonthDebt: priorDebt.results.reduce((sum, x) => sum + Math.max(Number(x.invoice_amount) - Number(x.paid_amount), 0), 0),
    };

    return json({ success:true,month,startDate,endDate,
      instructor:{id:auth.instructorId,name:`${instructor?.first_name ?? ''} ${instructor?.last_name ?? ''}`.trim(),payPercentage},
      totals,details,payments:paymentRows.results,
      priorDebt:priorDebt.results.map((row) => ({...row,balance:Math.max(Number(row.invoice_amount)-Number(row.paid_amount),0)})),
    });
  } catch (error) {
    console.error("[instructor/finance] request failed:", error);
    return json({ success:false,message:"دریافت اطلاعات مالی مدرس با خطا مواجه شد." },500);
  }
};
