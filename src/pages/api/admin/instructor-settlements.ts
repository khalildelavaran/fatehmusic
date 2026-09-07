export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { provisionEnrollmentSessionsForClassSession } from "../../../server/session-provisioning";
import { recordAuditEvent } from "../../../server/audit-log";

const METHODS = new Set(["cash", "pos", "transfer", "online", "other"]);

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return { startDate: `${month}-01`, endDate: next.toISOString().slice(0, 10) };
}

async function calculateWorkload(db: D1Database, month: string, instructorId?: number) {
  const { startDate, endDate } = monthRange(month);
  const sessions = await db.prepare(`
    SELECT id FROM class_sessions
    WHERE session_date >= ? AND session_date < ? AND status <> 'cancelled'
    ORDER BY session_date, start_time, id
  `).bind(startDate, endDate).all<{ id: number }>();
  for (const session of sessions.results) {
    try { await provisionEnrollmentSessionsForClassSession(db, session.id); }
    catch (error) { console.warn(`[admin/instructor-settlements] session ${session.id} provisioning skipped:`, error); }
  }

  const filter = instructorId ? "AND cs.instructor_id = ?" : "";
  const bindings = instructorId ? [startDate, endDate, instructorId] : [startDate, endDate];
  const rows = await db.prepare(`
    SELECT
      cs.instructor_id,
      SUM(CASE WHEN es.status IN ('present', 'absent') THEN 1 ELSE 0 END) AS compensable_sessions,
      SUM(CASE
        WHEN es.status IN ('present', 'absent')
         AND et.billing_type = 'session_based'
         AND et.tuition_amount IS NOT NULL
         AND et.planned_sessions IS NOT NULL
         AND et.planned_sessions > 0
        THEN CAST(et.tuition_amount AS REAL) / et.planned_sessions
        ELSE 0
      END) AS session_value_total
    FROM class_sessions cs
    JOIN enrollment_sessions es ON es.session_id = cs.id
    JOIN enrollments e ON e.id = es.enrollment_id
    LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
    WHERE cs.session_date >= ? AND cs.session_date < ?
      AND cs.status <> 'cancelled'
      AND e.class_id = cs.class_id
      ${filter}
    GROUP BY cs.instructor_id
  `).bind(...bindings).all<{ instructor_id: number; compensable_sessions: number; session_value_total: number }>();

  const instructors = await db.prepare(`
    SELECT id, first_name, last_name, pay_percentage
    FROM instructors
    WHERE is_active = 1 ${instructorId ? "AND id = ?" : ""}
    ORDER BY first_name, last_name, id
  `).bind(...(instructorId ? [instructorId] : [])).all<{ id: number; first_name: string; last_name: string; pay_percentage: number | null }>();

  const byId = new Map(rows.results.map(row => [row.instructor_id, row]));
  return instructors.results.map(row => {
    const work = byId.get(row.id);
    const percentage = Math.min(100, Math.max(0, Number(row.pay_percentage ?? 50)));
    const sessionValueTotal = Number(work?.session_value_total ?? 0);
    return {
      instructorId: row.id,
      instructorName: `${row.first_name} ${row.last_name}`.trim(),
      payPercentage: percentage,
      compensableSessions: Number(work?.compensable_sessions ?? 0),
      sessionValueTotal,
      payableAmount: Math.round(sessionValueTotal * percentage / 100),
    };
  });
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ success: false, message: "ماه معتبر نیست." }, 422);
    const workload = await calculateWorkload(db, month);
    const rows = await db.prepare(`
      SELECT id, instructor_id, settlement_month, amount, payment_method, paid_at, note
      FROM instructor_settlements WHERE settlement_month = ?
      ORDER BY paid_at DESC, id DESC
    `).bind(month).all<any>();
    const settlements = new Map(rows.results.map(row => [Number(row.instructor_id), row]));
    const instructors = workload.map(row => {
      const settlement = settlements.get(row.instructorId);
      const paid = !!settlement;
      return {
        ...row,
        status: paid ? "paid" : "pending",
        settlementId: settlement ? Number(settlement.id) : null,
        paidAmount: settlement ? Number(settlement.amount) : 0,
        paymentMethod: settlement?.payment_method ?? null,
        paidAt: settlement?.paid_at ?? null,
        note: settlement?.note ?? null,
      };
    });
    return json({ success: true, month, instructors, totals: {
      payableAmount: instructors.reduce((sum, row) => sum + row.payableAmount, 0),
      paidAmount: instructors.reduce((sum, row) => sum + row.paidAmount, 0),
      pendingAmount: instructors.reduce((sum, row) => sum + (row.status === "pending" ? row.payableAmount : 0), 0),
      paidCount: instructors.filter(row => row.status === "paid").length,
      pendingCount: instructors.filter(row => row.status === "pending").length,
    }});
  } catch (error) {
    console.error("[admin/instructor-settlements] GET failed:", error);
    return json({ success: false, message: "دریافت وضعیت تسویه اساتید با خطا مواجه شد." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
    const body = await request.json().catch(() => null) as any;
    const instructorId = Number(body?.instructorId);
    const month = String(body?.month ?? "");
    const paymentMethod = String(body?.paymentMethod ?? "cash");
    const note = String(body?.note ?? "").trim();
    if (!Number.isInteger(instructorId) || instructorId <= 0) return json({ success: false, message: "استاد معتبر نیست." }, 422);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ success: false, message: "ماه معتبر نیست." }, 422);
    if (!METHODS.has(paymentMethod)) return json({ success: false, message: "روش پرداخت معتبر نیست." }, 422);
    if (note.length > 1000) return json({ success: false, message: "یادداشت بیش از حد طولانی است." }, 422);

    const workload = await calculateWorkload(db, month, instructorId);
    const row = workload[0];
    if (!row) return json({ success: false, message: "استاد فعال پیدا نشد." }, 404);
    if (row.payableAmount <= 0) return json({ success: false, message: "مبلغ قابل پرداخت این استاد در این ماه صفر است." }, 422);
    const existing = await db.prepare(`SELECT id FROM instructor_settlements WHERE instructor_id = ? AND settlement_month = ?`).bind(instructorId, month).first<{ id: number }>();
    if (existing) return json({ success: false, message: "این استاد برای این ماه قبلاً تسویه شده است." }, 409);

    const result = await db.prepare(`
      INSERT INTO instructor_settlements (instructor_id, settlement_month, amount, payment_method, paid_at, note)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
    `).bind(instructorId, month, row.payableAmount, paymentMethod, note || null).run();
    await recordAuditEvent(db, { actor: { type: "admin" }, action: "instructor_settlement.create", entityType: "instructor_settlement", entityId: Number(result.meta?.last_row_id ?? 0), metadata: { instructorId, month, amount: row.payableAmount, paymentMethod } });
    return json({ success: true, amount: row.payableAmount, message: "تسویه استاد با موفقیت ثبت شد." }, 201);
  } catch (error) {
    console.error("[admin/instructor-settlements] POST failed:", error);
    return json({ success: false, message: "ثبت تسویه استاد با خطا مواجه شد." }, 500);
  }
};
