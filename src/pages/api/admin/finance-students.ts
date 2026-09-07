export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { calculateFinance } from "../../../server/finance-calculations";

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const today = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

    const rows = await db.prepare(`
      SELECT
        s.id AS student_id,
        TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')) AS student_name,
        e.id AS enrollment_id,
        c.title AS class_title,
        et.id AS term_id,
        et.term_number,
        et.billing_type,
        et.planned_sessions,
        et.tuition_amount,
        et.tuition_due_date,
        i.id AS invoice_id,
        i.amount AS invoice_amount,
        i.due_date,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid_amount,
        COALESCE((SELECT COUNT(*) FROM enrollment_sessions es JOIN class_sessions cs ON cs.id=es.session_id
          WHERE es.enrollment_id=e.id AND es.enrollment_term_id=et.id AND cs.status<>'cancelled'
          AND es.status IN ('present','absent')),0) AS consumed_sessions,
        COALESCE((SELECT COUNT(*) FROM enrollment_sessions es JOIN class_sessions cs ON cs.id=es.session_id
          WHERE es.enrollment_id=e.id AND es.enrollment_term_id=et.id AND cs.status<>'cancelled' AND es.status='excused'),0) AS leave_sessions
      FROM students s
      JOIN enrollments e ON e.student_id=s.id AND e.status='active'
      JOIN classes c ON c.id=e.class_id
      LEFT JOIN enrollment_terms et ON et.enrollment_id=e.id AND et.status='active'
      LEFT JOIN invoices i ON i.id=(SELECT i2.id FROM invoices i2 WHERE i2.enrollment_term_id=et.id AND i2.status<>'cancelled' ORDER BY i2.id DESC LIMIT 1)
      WHERE s.status='active'
      ORDER BY student_name, e.id
    `).bind().all<any>();

    const students = rows.results.filter((row:any) => row.term_id).map((row:any) => {
      const finance = calculateFinance({
        invoiceAmount: Number(row.invoice_amount ?? row.tuition_amount ?? 0),
        paidAmount: Number(row.paid_amount ?? 0),
        dueDate: row.due_date ?? row.tuition_due_date,
        today,
        billingType: row.billing_type,
        plannedSessions: row.planned_sessions,
        consumedSessions: Number(row.consumed_sessions ?? 0),
      });
      const remaining = row.planned_sessions == null ? null : Math.max(Number(row.planned_sessions) - Number(row.consumed_sessions ?? 0), 0);
      return {
        studentId: row.student_id,
        studentName: row.student_name,
        enrollmentId: row.enrollment_id,
        classTitle: row.class_title,
        termNumber: row.term_number,
        plannedSessions: row.planned_sessions,
        consumedSessions: Number(row.consumed_sessions ?? 0),
        leaveSessions: Number(row.leave_sessions ?? 0),
        remainingSessions: remaining,
        billingType: row.billing_type,
        invoiceId: row.invoice_id,
        invoiceAmount: finance.invoiceAmount,
        paidAmount: finance.paidAmount,
        balance: finance.balance,
        balanceToDate: finance.balanceToDate,
        unpaidSessions: finance.unpaidSessions,
        dueDate: finance.dueDate,
        overdue: finance.overdue,
        nearDue: finance.nearDue,
        financialStatus: row.invoice_id ? finance.financialStatus : "none",
      };
    });

    return json({
      success: true,
      date: today,
      students,
      totals: {
        students: students.length,
        debtors: students.filter((row:any) => row.balance > 0).length,
        outstanding: students.reduce((sum:number,row:any) => sum + row.balance, 0),
        dueToDate: students.reduce((sum:number,row:any) => sum + row.balanceToDate, 0),
        overdue: students.filter((row:any) => row.overdue).reduce((sum:number,row:any) => sum + row.balance, 0),
      },
    });
  } catch (error) {
    console.error("[admin/finance-students] request failed:", error);
    return json({ success: false, message: "دریافت حساب هنرجویان با خطا مواجه شد." }, 500);
  }
};
