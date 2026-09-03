export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";

function normalizeMethod(value: unknown): "cash" | "pos" | "transfer" | "online" {
  const method = String(value ?? "").trim().toLowerCase();
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
      invoiceId?: unknown; amount?: unknown; method?: unknown; reference?: unknown; note?: unknown;
    } | null;
    const invoiceId = Number(body?.invoiceId);
    const amount = Number(body?.amount);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) return json({ success: false, message: "صورتحساب معتبر نیست." }, 422);
    if (!Number.isInteger(amount) || amount <= 0) return json({ success: false, message: "مبلغ پرداخت باید عدد صحیح بزرگ‌تر از صفر باشد." }, 422);

    const invoice = await db.prepare(`
      SELECT id, amount, due_date, status FROM invoices WHERE id = ?
    `).bind(invoiceId).first<{ id:number; amount:number; due_date:string|null; status:string }>();
    if (!invoice) return json({ success: false, message: "صورتحساب یافت نشد." }, 404);
    if (invoice.status === "cancelled") return json({ success: false, message: "این صورتحساب لغو شده است." }, 409);

    const paidRow = await db.prepare(`SELECT COALESCE(SUM(amount),0) total FROM payments WHERE invoice_id=?`)
      .bind(invoiceId).first<{ total:number }>();
    const alreadyPaid = Number(paidRow?.total ?? 0);
    const balance = Math.max(invoice.amount - alreadyPaid, 0);
    if (balance <= 0) return json({ success: false, message: "این صورتحساب قبلاً تسویه شده است." }, 409);
    if (amount > balance) return json({ success: false, message: `مبلغ پرداخت بیشتر از مانده ${balance.toLocaleString("fa-IR")} است.` }, 422);

    const payment = await db.prepare(`
      INSERT INTO payments (invoice_id, amount, paid_at, method, reference, note)
      VALUES (?, ?, datetime('now'), ?, ?, ?)
      RETURNING id
    `).bind(
      invoiceId,
      amount,
      normalizeMethod(body?.method),
      typeof body?.reference === "string" && body.reference.trim() ? body.reference.trim() : null,
      typeof body?.note === "string" ? body.note.trim() : "",
    ).first<{ id:number }>();
    if (!payment) throw new Error("PAYMENT_CREATE_FAILED");

    const newPaid = alreadyPaid + amount;
    const today = new Date().toISOString().slice(0, 10);
    const nextStatus = newPaid >= invoice.amount ? "paid" : invoice.due_date && invoice.due_date < today ? "overdue" : "pending";
    await db.prepare(`UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?`).bind(nextStatus, invoiceId).run();

    return json({
      success: true,
      paymentId: payment.id,
      invoiceId,
      invoiceAmount: invoice.amount,
      paidAmount: newPaid,
      balance: Math.max(invoice.amount - newPaid, 0),
      invoiceStatus: nextStatus,
    }, 201);
  } catch (error) {
    console.error("[admin/payments] request failed:", error);
    return json({ success: false, message: "ثبت پرداخت با خطا مواجه شد." }, 500);
  }
};
