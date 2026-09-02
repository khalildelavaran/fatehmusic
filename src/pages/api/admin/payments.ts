export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMethod(value: unknown): "cash" | "pos" | "transfer" | "online" {
  const method = String(value ?? "").trim().toLowerCase();
  if (method === "cash") return "cash";
  if (method === "pos" || method === "card" || method === "card_reader") return "pos";
  if (method === "transfer" || method === "bank" || method === "card_to_card") return "transfer";
  if (method === "online" || method === "gateway" || method === "internet") return "online";
  return "cash";
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;

    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as {
      invoiceId?: unknown;
      amount?: unknown;
      method?: unknown;
      reference?: unknown;
      note?: unknown;
    } | null;

    const invoiceId = Number(body?.invoiceId);
    const amount = Number(body?.amount);
    const method = normalizeMethod(body?.method);
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!Number.isInteger(invoiceId) || invoiceId <= 0) return json({ success: false, message: "صورتحساب معتبر نیست." }, 422);
    if (!Number.isInteger(amount) || amount <= 0) return json({ success: false, message: "مبلغ پرداخت باید یک عدد صحیح بزرگ‌تر از صفر باشد." }, 422);

    const invoice = await db.prepare(`
      SELECT id, enrollment_term_id, amount, due_date, status
      FROM invoices
      WHERE id = ?
    `).bind(invoiceId).first<{ id: number; enrollment_term_id: number; amount: number; due_date: string | null; status: string }>();

    if (!invoice) return json({ success: false, message: "صورتحساب یافت نشد." }, 404);
    if (invoice.status === "cancelled") return json({ success: false, message: "این صورتحساب لغو شده است." }, 409);

    const paid = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = ?`).bind(invoiceId).first<{ total_paid: number }>();
    const alreadyPaid = paid?.total_paid ?? 0;
    const balance = Math.max(invoice.amount - alreadyPaid, 0);
    if (balance <= 0) return json({ success: false, message: "این صورتحساب قبلاً به‌طور کامل پرداخت شده است." }, 409);
    if (amount > balance) return json({ success: false, message: `مبلغ پرداخت نمی‌تواند بیشتر از مانده ${balance.toLocaleString("fa-IR")} باشد.` }, 422);

    const payment = await db.prepare(`
      INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
      VALUES (?, ?, datetime('now'), ?, ?, ?)
      RETURNING id
    `).bind(invoiceId, amount, method, reference || null, note).first<{ id: number }>();

    if (!payment) return json({ success: false, message: "پرداخت ثبت نشد." }, 500);

    const newPaid = alreadyPaid + amount;
    const newStatus = newPaid >= invoice.amount ? "paid" : (invoice.due_date && invoice.due_date < todayIso() ? "overdue" : "pending");
    await db.prepare(`UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(newStatus, invoiceId).run();

    return json({ success: true, paymentId: payment.id, invoiceId, invoiceAmount: invoice.amount, paidAmount: newPaid, balance: Math.max(invoice.amount - newPaid, 0), invoiceStatus: newStatus, method });
  } catch (error) {
    console.error("[admin/payments] request failed:", error);
    return json({ success: false, message: "ثبت پرداخت با خطا مواجه شد." }, 500);
  }
};
