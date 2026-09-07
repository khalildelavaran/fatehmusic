export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { recordAuditEvent } from "../../../server/audit-log";
import { provisionEnrollmentSessionsForClassSession } from "../../../server/session-provisioning";

const METHODS = ["cash", "pos", "transfer", "online", "other"] as const;
type PaymentMethod = (typeof METHODS)[number];

function normalizeMethod(value: unknown): PaymentMethod {
  const method = String(value ?? "cash").trim().toLowerCase();
  if (method === "pos" || method === "card" || method === "card_reader") return "pos";
  if (method === "transfer" || method === "bank" || method === "card_to_card") return "transfer";
  if (method === "online" || method === "gateway" || method === "internet") return "online";
  if (method === "other") return "other";
  return "cash";
}

function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!validMonth(month)) return json({ success: false, message: "ماه معتبر نیست." }, 422);
    const startDate = `${month}-01`;
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, monthNumber, 1));
    const endDate = next.toISOString().slice(0, 10);

    const monthSessions = await db.prepare(`
      SELECT id FROM class_sessions
      WHERE session_date >= ? AND session_date < ? AND status <> 'cancelled'
      ORDER BY session_date, start_time, id
    `).bind(startDate, endDate).all<{ id: number }>();
    for (const session of monthSessions.results) {
      try { await provisionEnrollmentSessionsForClassSession(db, session.id); }
      catch (error) { console.warn(`[admin/teacher-workload] session ${session.id} provisioning skipped:`, error); }
    }

    const instructorRows = await db.prepare(`
      SELECT id, first_name, last_name, pay_percentage
      FROM instructors
      WHERE is_active = 1
      ORDER BY first_name, last_name, id
    `).all<{ id: number; first_name: string; last_name: string; pay_percentage: number | null }>();

    const workRows = await db.prepare(`
      SELECT
        cs.instructor_id,
        COUNT(DISTINCT cs.id) AS class_sessions,
        SUM(CASE WHEN es.status IN ('present', 'absent') THEN 1 ELSE 0 END) AS student_sessions,
        SUM(CASE WHEN es.status = 'present' THEN 1 ELSE 0 END) AS present_sessions,
        SUM(CASE WHEN es.status = 'absent' THEN 1 ELSE 0 END) AS absent_sessions,
        SUM(CASE WHEN es.status = 'excused' THEN 1 ELSE 0 END) AS excused_sessions,
        SUM(CASE WHEN es.status = 'pending' THEN 1 ELSE 0 END) AS pending_sessions,
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
      WHERE cs.session_date >= ?
        AND cs.session_date < ?
        AND cs.status <> 'cancelled'
        AND e.class_id = cs.class_id
      GROUP BY cs.instructor_id
    `).bind(startDate, endDate).all<{
      instructor_id: number; class_sessions: number; student_sessions: number;
      present_sessions: number; absent_sessions: number; excused_sessions: number;
      pending_sessions: number; session_value_total: number;
    }>();

    const settlementRows = await db.prepare(`
      SELECT id, instructor_id, amount_due, paid_amount, status, paid_at, payment_method, reference, note
      FROM instructor_settlements
      WHERE settlement_month = ?
    `).bind(month).all<{
      id: number; instructor_id: number; amount_due: number; paid_amount: number;
      status: "pending" | "paid"; paid_at: string | null; payment_method: PaymentMethod;
      reference: string | null; note: string | null;
    }>();

    const byInstructor = new Map(workRows.results.map((row) => [row.instructor_id, row]));
    const settlements = new Map(settlementRows.results.map((row) => [row.instructor_id, row]));
    const instructors = instructorRows.results.map((row) => {
      const work = byInstructor.get(row.id);
      const settlement = settlements.get(row.id);
      const percentage = Math.min(100, Math.max(0, Number(row.pay_percentage ?? 50)));
      const presentSessions = Number(work?.present_sessions ?? 0);
      const absentSessions = Number(work?.absent_sessions ?? 0);
      const sessionValueTotal = Number(work?.session_value_total ?? 0);
      const instructorShare = sessionValueTotal * (percentage / 100);
      return {
        instructorId: row.id,
        instructorName: `${row.first_name} ${row.last_name}`.trim(),
        payPercentage: percentage,
        classSessions: Number(work?.class_sessions ?? 0),
        studentSessions: Number(work?.student_sessions ?? 0),
        presentSessions,
        absentSessions,
        excusedSessions: Number(work?.excused_sessions ?? 0),
        pendingSessions: Number(work?.pending_sessions ?? 0),
        compensableSessions: presentSessions + absentSessions,
        sessionValueTotal,
        instructorShare,
        payableAmount: Math.round(instructorShare),
        hasSessionBasedAmount: sessionValueTotal > 0,
        settlement: settlement ? {
          id: settlement.id,
          status: settlement.status,
          amountDue: Number(settlement.amount_due),
          paidAmount: Number(settlement.paid_amount),
          paidAt: settlement.paid_at,
          paymentMethod: settlement.payment_method,
          reference: settlement.reference,
          note: settlement.note,
        } : null,
      };
    });

    return json({
      success: true,
      month,
      startDate,
      endDate,
      instructors,
      totals: {
        classSessions: instructors.reduce((sum, row) => sum + row.classSessions, 0),
        studentSessions: instructors.reduce((sum, row) => sum + row.studentSessions, 0),
        compensableSessions: instructors.reduce((sum, row) => sum + row.compensableSessions, 0),
        absentSessions: instructors.reduce((sum, row) => sum + row.absentSessions, 0),
        instructorShare: instructors.reduce((sum, row) => sum + row.instructorShare, 0),
        payableAmount: instructors.reduce((sum, row) => sum + row.payableAmount, 0),
        paidAmount: instructors.reduce((sum, row) => sum + (row.settlement?.status === "paid" ? row.settlement.paidAmount : 0), 0),
        pendingAmount: instructors.reduce((sum, row) => sum + (row.settlement?.status === "paid" ? 0 : row.payableAmount), 0),
      },
    });
  } catch (error) {
    console.error("[admin/teacher-workload] request failed:", error);
    return json({ success: false, message: "محاسبه کارکرد اساتید با خطا مواجه شد." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const instructorId = Number(body?.instructorId);
    const month = body?.month;
    const amountDue = Number(body?.amountDue);
    const status = body?.status === "paid" ? "paid" : body?.status === "pending" ? "pending" : "";
    const paymentMethod = normalizeMethod(body?.paymentMethod);
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!Number.isInteger(instructorId) || instructorId <= 0) return json({ success: false, message: "شناسه استاد معتبر نیست." }, 422);
    if (!validMonth(month)) return json({ success: false, message: "ماه معتبر نیست." }, 422);
    if (!Number.isInteger(amountDue) || amountDue < 0) return json({ success: false, message: "مبلغ قابل پرداخت معتبر نیست." }, 422);
    if (!status) return json({ success: false, message: "وضعیت تسویه معتبر نیست." }, 422);
    if (reference.length > 200 || note.length > 1000) return json({ success: false, message: "طول یکی از فیلدها بیش از حد مجاز است." }, 422);

    const instructor = await db.prepare(`SELECT id, first_name, last_name FROM instructors WHERE id = ? AND is_active = 1`).bind(instructorId).first<{ id: number; first_name: string; last_name: string }>();
    if (!instructor) return json({ success: false, message: "استاد فعال یافت نشد." }, 404);

    const paidAmount = status === "paid" ? amountDue : 0;
    const paidAt = status === "paid" ? new Date().toISOString() : null;
    const existing = await db.prepare(`SELECT id FROM instructor_settlements WHERE instructor_id=? AND settlement_month=?`).bind(instructorId, month).first<{ id:number }>();

    if (existing) {
      await db.prepare(`
        UPDATE instructor_settlements
        SET amount_due=?, paid_amount=?, status=?, paid_at=?, payment_method=?, reference=?, note=?, updated_at=datetime('now')
        WHERE id=?
      `).bind(amountDue, paidAmount, status, paidAt, paymentMethod, reference || null, note || null, existing.id).run();
    } else {
      await db.prepare(`
        INSERT INTO instructor_settlements (instructor_id,settlement_month,amount_due,paid_amount,status,paid_at,payment_method,reference,note)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).bind(instructorId, month, amountDue, paidAmount, status, paidAt, paymentMethod, reference || null, note || null).run();
    }

    await recordAuditEvent(db, {
      actor: { type: "admin", label: "admin-api" },
      action: status === "paid" ? "instructor_settlement.paid" : "instructor_settlement.pending",
      entityType: "instructor_settlement",
      entityId: existing?.id ?? null,
      metadata: { instructorId, instructorName: `${instructor.first_name} ${instructor.last_name}`.trim(), month, amountDue, paidAmount, status, paymentMethod, reference: reference || null },
    });

    return json({ success: true, status, instructorId, month, amountDue, paidAmount }, existing ? 200 : 201);
  } catch (error) {
    console.error("[admin/teacher-workload] settlement request failed:", error);
    return json({ success: false, message: "ثبت وضعیت تسویه استاد با خطا مواجه شد." }, 500);
  }
};
