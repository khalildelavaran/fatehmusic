export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { calculateFinance } from "../../../server/finance-calculations";

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const studentId = Number(url.searchParams.get("studentId"));
    const today = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    if (!Number.isInteger(studentId) || studentId <= 0) return json({ success: false, message: "شناسه هنرجو معتبر نیست." }, 422);
    if (!isDate(today)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

    const student = await db.prepare(`SELECT id,TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS name FROM students WHERE id=?`).bind(studentId).first<{id:number;name:string}>();
    if (!student) return json({ success: false, message: "هنرجو یافت نشد." }, 404);

    const terms = await db.prepare(`
      SELECT e.id AS enrollment_id,c.title AS class_title,et.id AS term_id,et.term_number,et.start_date,et.planned_sessions,et.billing_type,et.tuition_amount,et.tuition_due_date,
        i.id AS invoice_id,i.amount AS invoice_amount,i.due_date,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid_amount,
        COALESCE((SELECT COUNT(*) FROM enrollment_sessions es JOIN class_sessions cs ON cs.id=es.session_id WHERE es.enrollment_id=e.id AND es.enrollment_term_id=et.id AND cs.status<>'cancelled' AND es.status IN ('present','absent')),0) AS consumed_sessions,
        COALESCE((SELECT COUNT(*) FROM enrollment_sessions es JOIN class_sessions cs ON cs.id=es.session_id WHERE es.enrollment_id=e.id AND es.enrollment_term_id=et.id AND cs.status<>'cancelled' AND es.status='excused'),0) AS leave_sessions
      FROM enrollments e JOIN classes c ON c.id=e.class_id JOIN enrollment_terms et ON et.enrollment_id=e.id
      LEFT JOIN invoices i ON i.id=(SELECT i2.id FROM invoices i2 WHERE i2.enrollment_term_id=et.id AND i2.status<>'cancelled' ORDER BY i2.id DESC LIMIT 1)
      WHERE e.student_id=? AND et.status<>'cancelled'
      ORDER BY et.start_date,e.id,et.term_number
    `).bind(studentId).all<any>();

    const accountTerms = (terms.results ?? []).map((row:any) => {
      const finance = calculateFinance({ invoiceAmount:Number(row.invoice_amount ?? row.tuition_amount ?? 0), paidAmount:Number(row.paid_amount ?? 0), dueDate:row.due_date ?? row.tuition_due_date, today, billingType:row.billing_type, plannedSessions:row.planned_sessions, consumedSessions:Number(row.consumed_sessions ?? 0) });
      return { enrollmentId:Number(row.enrollment_id), classTitle:row.class_title, termId:Number(row.term_id), termNumber:Number(row.term_number), startDate:row.start_date, plannedSessions:row.planned_sessions, consumedSessions:Number(row.consumed_sessions ?? 0), leaveSessions:Number(row.leave_sessions ?? 0), billingType:row.billing_type, invoiceId:row.invoice_id ? Number(row.invoice_id) : null, invoiceAmount:finance.invoiceAmount, paidAmount:finance.paidAmount, balance:finance.balance, balanceToDate:finance.balanceToDate, amountDueToDate:finance.amountDueToDate, unpaidSessions:finance.unpaidSessions, dueDate:finance.dueDate, overdue:finance.overdue, financialStatus:row.invoice_id ? finance.financialStatus : "none" };
    });

    const payments = await db.prepare(`
      SELECT p.id,p.invoice_id,p.amount,p.paid_at,p.method,p.reference,p.note,i.enrollment_term_id,et.term_number,c.title AS class_title
      FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN enrollment_terms et ON et.id=i.enrollment_term_id JOIN enrollments e ON e.id=et.enrollment_id JOIN classes c ON c.id=e.class_id
      WHERE e.student_id=? AND i.status<>'cancelled'
      ORDER BY p.paid_at DESC,p.id DESC
    `).bind(studentId).all<any>();

    const totalInvoiced=accountTerms.reduce((s:any,r:any)=>s+r.invoiceAmount,0);
    const totalPaid=accountTerms.reduce((s:any,r:any)=>s+r.paidAmount,0);
    const totalBalance=accountTerms.reduce((s:any,r:any)=>s+r.balance,0);
    const totalDueToDate=accountTerms.reduce((s:any,r:any)=>s+r.amountDueToDate,0);
    return json({ success:true, date:today, student:{id:student.id,name:student.name}, summary:{totalInvoiced,totalPaid,totalBalance,totalDueToDate,credit:Math.max(totalPaid-totalInvoiced,0),status:totalBalance>0?"debtor":totalPaid>totalInvoiced?"creditor":"settled"}, terms:accountTerms, payments:(payments.results??[]).map((p:any)=>({id:Number(p.id),invoiceId:Number(p.invoice_id),amount:Number(p.amount),paidAt:p.paid_at,method:p.method,reference:p.reference,note:p.note,classTitle:p.class_title,termNumber:Number(p.term_number)})) });
  } catch (error) {
    console.error("[admin/student-account] request failed:", error);
    return json({ success:false, message:"گردش حساب هنرجو با خطا مواجه شد." },500);
  }
};
