export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";

const METHODS = ["cash", "pos", "transfer", "online"] as const;
type PaymentMethod = (typeof METHODS)[number];

function normalizeMethod(value: unknown): PaymentMethod | "other" {
  const method = String(value ?? "").trim().toLowerCase();
  if (method === "cash") return "cash";
  if (method === "pos" || method === "card" || method === "card_reader") return "pos";
  if (method === "transfer" || method === "bank" || method === "card_to_card") return "transfer";
  if (method === "online" || method === "gateway" || method === "internet") return "online";
  return "other";
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);

    const paymentRows = await db.prepare(`
      SELECT
        p.id,
        p.amount,
        p.paid_at,
        p.method,
        p.reference,
        p.note,
        i.id AS invoice_id,
        s.id AS student_id,
        TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS student_name,
        c.title AS class_title,
        et.id AS term_id,
        e.id AS enrollment_id
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN enrollment_terms et ON et.id = i.enrollment_term_id
      JOIN enrollments e ON e.id = et.enrollment_id
      JOIN students s ON s.id = e.student_id
      LEFT JOIN classes c ON c.id = e.class_id
      WHERE date(p.paid_at) = ?
      ORDER BY p.paid_at DESC, p.id DESC
    `).bind(date).all<{
      id: number; amount: number; paid_at: string; method: string | null; reference: string | null;
      note: string; invoice_id: number; student_id: number; student_name: string;
      class_title: string | null; term_id: number; enrollment_id: number;
    }>();

    const debtRows = await db.prepare(`
      SELECT
        i.id AS invoice_id,
        i.amount AS invoice_amount,
        i.due_date,
        i.status,
        e.id AS enrollment_id,
        s.id AS student_id,
        TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) AS student_name,
        c.title AS class_title,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
      FROM invoices i
      JOIN enrollment_terms et ON et.id = i.enrollment_term_id
      JOIN enrollments e ON e.id = et.enrollment_id
      JOIN students s ON s.id = e.student_id
      LEFT JOIN classes c ON c.id = e.class_id
      WHERE i.status <> 'cancelled'
      ORDER BY CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END, i.due_date ASC, i.id ASC
    `).bind().all<{
      invoice_id: number; invoice_amount: number; due_date: string | null; status: string;
      enrollment_id: number; student_id: number; student_name: string;
      class_title: string | null; paid_amount: number;
    }>();

    const payments = paymentRows.results.map((row) => ({
      ...row,
      method: normalizeMethod(row.method),
    }));

    const debts = debtRows.results
      .map((row) => ({
        ...row,
        balance: Math.max(row.invoice_amount - row.paid_amount, 0),
        paymentStatus: row.paid_amount >= row.invoice_amount ? "paid" : row.paid_amount > 0 ? "partial" : row.status,
      }))
      .filter((row) => row.balance > 0);

    const methodTotals: Record<string, number> = { cash: 0, pos: 0, transfer: 0, online: 0, other: 0 };
    for (const payment of payments) methodTotals[payment.method] = (methodTotals[payment.method] ?? 0) + payment.amount;

    return json({
      success: true,
      date,
      summary: {
        receivedTotal: payments.reduce((sum, row) => sum + row.amount, 0),
        outstandingTotal: debts.reduce((sum, row) => sum + row.balance, 0),
        overdueTotal: debts.filter((row) => row.due_date && row.due_date < date).reduce((sum, row) => sum + row.balance, 0),
        receivedCount: payments.length,
        debtorCount: debts.length,
        methodTotals,
      },
      payments,
      debts,
    });
  } catch (error) {
    console.error("[admin/daily-finance] request failed:", error);
    return json({ success: false, message: "دریافت اطلاعات مالی با خطا مواجه شد." }, 500);
  }
};
