import type { APIRoute } from "astro";

export const prerender = false;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type EndOfDayStatus = "open" | "ready" | "needs_attention" | "closed";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !["admin", "registrar"].includes(String(user.role))) {
    return new Response(JSON.stringify({ success: false, message: "دسترسی مجاز نیست." }), { status: 401, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) return new Response(JSON.stringify({ success: false, message: "تاریخ نامعتبر است." }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
  const db = locals.runtime?.env?.DB;
  if (!db) return new Response(JSON.stringify({ success: false, message: "اتصال پایگاه‌داده در دسترس نیست." }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });

  const [sessions, attendance, finance, closure] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN status != 'cancelled' AND (teacher_attendance_status IS NULL OR teacher_attendance_status = 'pending') THEN 1 ELSE 0 END) AS teacher_pending FROM class_sessions WHERE session_date = ?`).bind(date).first(),
    db.prepare(`SELECT SUM(CASE WHEN es.status = 'pending' THEN 1 ELSE 0 END) AS pending FROM enrollment_sessions es JOIN class_sessions cs ON cs.id = es.session_id WHERE cs.session_date = ? AND cs.status != 'cancelled'`).bind(date).first(),
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN i.due_date <= ? AND i.status <> 'cancelled' THEN MAX(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0), 0) ELSE 0 END), 0) AS balance_due, COALESCE(SUM(CASE WHEN i.due_date <= ? AND i.status <> 'cancelled' AND (i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)) > 0 THEN 1 ELSE 0 END), 0) AS overdue_count FROM invoices i`).bind(date, date).first(),
    db.prepare(`SELECT id, close_date, closed_by, closed_at FROM daily_closures WHERE close_date = ?`).bind(date).first(),
  ]);

  const total = Number(sessions?.total || 0);
  const cancelled = Number(sessions?.cancelled || 0);
  const teacherPending = Number(sessions?.teacher_pending || 0);
  const attendancePending = Number(attendance?.pending || 0);
  const overdueCount = Number(finance?.overdue_count || 0);
  const balanceDue = Number(finance?.balance_due || 0);
  const active = Math.max(0, total - cancelled);
  const issues = [teacherPending > 0, attendancePending > 0, overdueCount > 0].filter(Boolean).length;
  const status: EndOfDayStatus = closure ? "closed" : issues > 0 ? "needs_attention" : active === 0 ? "open" : "ready";

  return new Response(JSON.stringify({ success: true, date, status, closure: closure ? { id: Number(closure.id), closed_by: closure.closed_by === null ? null : Number(closure.closed_by), closed_at: String(closure.closed_at) } : null, summary: { sessions_total: total, sessions_cancelled: cancelled, active_sessions: active, teacher_attendance_pending: teacherPending, student_attendance_pending: attendancePending, overdue_count: overdueCount, balance_due: balanceDue }, close_checklist: { teacher_attendance: teacherPending === 0, student_attendance: attendancePending === 0, finance_overdue: overdueCount === 0 } }), { headers: { "content-type": "application/json; charset=utf-8" } });
};
