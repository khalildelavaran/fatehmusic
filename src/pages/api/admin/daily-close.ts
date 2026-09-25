import type { APIRoute } from "astro";
import { recordAuditEvent } from "../../../server/audit-log";

export const prerender = false;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !["admin", "registrar"].includes(String(user.role))) {
    return new Response(JSON.stringify({ success: false, message: "دسترسی مجاز نیست." }), { status: 401, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const body = await request.json().catch(() => ({})) as { date?: unknown };
  const date = String(body.date || "");
  if (!DATE_RE.test(date)) {
    return new Response(JSON.stringify({ success: false, message: "تاریخ نامعتبر است." }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const db = locals.runtime?.env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ success: false, message: "اتصال پایگاه‌داده در دسترس نیست." }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const [sessions, attendance, finance] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN status != 'cancelled' AND (teacher_attendance_status IS NULL OR teacher_attendance_status = 'pending') THEN 1 ELSE 0 END) AS teacher_pending FROM class_sessions WHERE session_date = ?`).bind(date).first(),
    db.prepare(`SELECT SUM(CASE WHEN es.status = 'pending' THEN 1 ELSE 0 END) AS pending FROM enrollment_sessions es JOIN class_sessions cs ON cs.id = es.session_id WHERE cs.session_date = ? AND cs.status != 'cancelled'`).bind(date).first(),
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN i.due_date <= ? AND i.status <> 'cancelled' THEN MAX(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0), 0) ELSE 0 END), 0) AS balance_due, COALESCE(SUM(CASE WHEN i.due_date <= ? AND i.status <> 'cancelled' AND (i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)) > 0 THEN 1 ELSE 0 END), 0) AS overdue_count FROM invoices i`).bind(date, date).first(),
  ]);

  const teacherPending = Number(sessions?.teacher_pending || 0);
  const studentPending = Number(attendance?.pending || 0);
  const overdueCount = Number(finance?.overdue_count || 0);
  if (teacherPending || studentPending || overdueCount) {
    return new Response(JSON.stringify({
      success: false,
      message: "روز هنوز آماده بستن نیست؛ ابتدا موارد نیازمند اقدام را تکمیل کنید.",
      close_checklist: {
        teacher_attendance: teacherPending === 0,
        student_attendance: studentPending === 0,
        finance_overdue: overdueCount === 0,
      },
    }), { status: 409, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const actorId = Number(user.id);
  const actorLabel = String(user.name || user.email || "کاربر اداری");
  const metadata = JSON.stringify({ source: "daily-command-center", close_date: date });
  const result = await db.prepare(`INSERT OR IGNORE INTO daily_closures (close_date, closed_by, metadata) VALUES (?, ?, ?)`).bind(date, Number.isInteger(actorId) && actorId > 0 ? actorId : null, metadata).run();
  const closure = await db.prepare(`SELECT id, close_date, closed_by, closed_at FROM daily_closures WHERE close_date = ?`).bind(date).first();
  const created = Number(result.meta?.changes || 0) > 0;

  if (created) {
    await recordAuditEvent(db, {
      actor: { type: String(user.role) === "ADMIN" ? "admin" : "registrar", id: Number.isInteger(actorId) && actorId > 0 ? actorId : null, label: actorLabel },
      action: "daily.close",
      entityType: "daily_closure",
      entityId: Number(closure?.id || 0) || null,
      metadata: { date, close_date: date, source: "daily-command-center" },
    });
  }

  return new Response(JSON.stringify({ success: true, date, status: "closed", already_closed: !created, closure }), { headers: { "content-type": "application/json; charset=utf-8" } });
};
