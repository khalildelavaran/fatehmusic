export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStudentSession, type StudentEnv } from "../../../server/student-auth";
import { json } from "../../../server/student-auth";
import { provisionEnrollmentSessionsForClassSession } from "../../../server/session-provisioning";

export const GET: APIRoute = async ({ request }) => {
  const session = await getStudentSession(request, env as StudentEnv);
  if (!session) return json({ success: false, message: "ورود هنرجو معتبر نیست." }, 401);
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const enrollments = await db.prepare(`
    SELECT e.id AS enrollment_id, e.class_id, c.title AS class_title,
      TRIM(COALESCE(i.first_name,'') || ' ' || COALESCE(i.last_name,'')) AS instructor_name,
      et.id AS term_id, et.term_number, et.planned_sessions, et.billing_type,
      et.tuition_amount, et.tuition_due_date
    FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN enrollment_terms et ON et.enrollment_id = e.id AND et.status = 'active'
    WHERE e.student_id = ? AND e.status = 'active'
    ORDER BY e.id DESC, et.term_number DESC
  `).bind(session.studentId).all<{
    enrollment_id:number; class_id:number; class_title:string; instructor_name:string;
    term_id:number|null; term_number:number|null; planned_sessions:number|null; billing_type:string|null;
    tuition_amount:number|null; tuition_due_date:string|null;
  }>();

  const result = [];
  for (const e of enrollments.results) {
    if (!e.term_id) continue;
    const sessions = await db.prepare(`
      SELECT es.id, es.session_id, es.status, es.note, cs.session_date, cs.start_time, cs.end_time
      FROM enrollment_sessions es
      JOIN class_sessions cs ON cs.id = es.session_id
      WHERE es.enrollment_id = ? AND es.enrollment_term_id = ? AND cs.status <> 'cancelled'
      ORDER BY cs.session_date ASC, cs.start_time ASC, es.id ASC
    `).bind(e.enrollment_id, e.term_id).all<{id:number;session_id:number;status:string;note:string;session_date:string;start_time:string;end_time:string}>();

    for (const s of sessions.results) {
      if (s.session_date <= new Date().toISOString().slice(0,10)) {
        try { await provisionEnrollmentSessionsForClassSession(db, s.session_id); } catch {}
      }
    }

    const attendance = sessions.results;
    const completed = attendance.filter(s => s.status === 'present').length;
    const absent = attendance.filter(s => s.status === 'absent').length;
    const leave = attendance.filter(s => s.status === 'excused').length;
    const consumed = completed + absent;
    const remaining = e.planned_sessions == null ? null : Math.max(e.planned_sessions - consumed, 0);

    const invoice = await db.prepare(`
      SELECT i.id, i.amount, i.due_date, i.status,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid_amount
      FROM invoices i WHERE i.enrollment_term_id=? AND i.status <> 'cancelled'
      ORDER BY i.id DESC LIMIT 1
    `).bind(e.term_id).first<{id:number;amount:number;due_date:string|null;status:string;paid_amount:number}>();
    const invoiceAmount = Number(invoice?.amount ?? e.tuition_amount ?? 0);
    const paidAmount = Number(invoice?.paid_amount ?? 0);
    const balance = Math.max(invoiceAmount - paidAmount, 0);
    const today = new Date().toISOString().slice(0,10);
    const dueDate = invoice?.due_date ?? e.tuition_due_date;
    const overdue = !!dueDate && dueDate < today && balance > 0;
    const nearDue = !!dueDate && dueDate >= today && Math.ceil((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86400000) <= 7 && balance > 0;
    const renewalWarning = remaining !== null && remaining <= 1 && balance > 0;

    const payments = await db.prepare(`
      SELECT p.id,p.amount,p.paid_at,p.method,p.reference
      FROM payments p JOIN invoices i ON i.id=p.invoice_id
      WHERE i.enrollment_term_id=? ORDER BY p.paid_at DESC,p.id DESC
    `).bind(e.term_id).all();

    result.push({
      enrollmentId:e.enrollment_id,classId:e.class_id,classTitle:e.class_title,instructorName:e.instructor_name,
      termId:e.term_id,termNumber:e.term_number,plannedSessions:e.planned_sessions,billingType:e.billing_type,
      tuitionAmount:e.tuition_amount,completedSessions:completed,absentSessions:absent,leaveSessions:leave,
      consumedSessions:consumed,remainingSessions:remaining,unpaidSessions:remaining === null ? null : Math.max(consumed - Math.floor(paidAmount / Math.max(Number(e.tuition_amount||0) / Math.max(Number(e.planned_sessions||1),1),1)),0),
      invoiceId:invoice?.id ?? null,invoiceAmount,paidAmount,balance,dueDate,overdue,nearDue,renewalWarning,
      financialStatus: balance <= 0 && invoice ? 'paid' : overdue ? 'overdue' : paidAmount > 0 ? 'partial' : invoice ? 'pending' : 'none',
      payments:payments.results
    });
  }
  return json({ success:true, enrollments:result });
};
