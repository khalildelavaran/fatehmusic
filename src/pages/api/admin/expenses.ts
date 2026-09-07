export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { recordAuditEvent } from "../../../server/audit-log";

const METHODS = ["cash", "pos", "transfer", "online", "other"] as const;
type PaymentMethod = (typeof METHODS)[number];

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeMethod(value: unknown): PaymentMethod {
  const method = String(value ?? "cash").trim().toLowerCase();
  if (method === "pos" || method === "card" || method === "card_reader") return "pos";
  if (method === "transfer" || method === "bank" || method === "card_to_card") return "transfer";
  if (method === "online" || method === "gateway" || method === "internet") return "online";
  if (method === "other") return "other";
  return "cash";
}

function rangeForMonth(month: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const month = url.searchParams.get("month") ?? (date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7));
    const range = rangeForMonth(month);
    if (!range) return json({ success: false, message: "ماه معتبر نیست." }, 422);

    const expenses = await db.prepare(`
      SELECT id,expense_date,category,description,amount,payment_method,reference,note,created_at,updated_at
      FROM finance_expenses
      WHERE expense_date BETWEEN ? AND ?
      ORDER BY expense_date DESC,id DESC
    `).bind(range.start, range.end).all<{
      id:number;expense_date:string;category:string;description:string;amount:number;payment_method:PaymentMethod;reference:string|null;note:string|null;created_at:string;updated_at:string;
    }>();

    const rows = expenses.results ?? [];
    const dailyRows = date && isDate(date) ? rows.filter((row) => row.expense_date === date) : [];
    const monthlyTotal = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const dailyTotal = dailyRows.reduce((sum, row) => sum + Number(row.amount), 0);
    const byCategory: Record<string, number> = {};
    const byMethod: Record<string, number> = { cash: 0, pos: 0, transfer: 0, online: 0, other: 0 };
    for (const row of rows) {
      byCategory[row.category] = (byCategory[row.category] ?? 0) + Number(row.amount);
      byMethod[normalizeMethod(row.payment_method)] += Number(row.amount);
    }

    return json({
      success: true,
      date: date && isDate(date) ? date : null,
      month,
      expenses: rows,
      dailyExpenses: dailyRows,
      summary: { dailyTotal, monthlyTotal, count: rows.length, dailyCount: dailyRows.length, byCategory, byMethod },
    });
  } catch (error) {
    console.error("[admin/expenses] GET failed:", error);
    return json({ success: false, message: "دریافت هزینه‌ها با خطا مواجه شد." }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const expenseDate = body?.expenseDate;
    const category = typeof body?.category === "string" ? body.category.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const amount = Number(body?.amount);
    const method = normalizeMethod(body?.paymentMethod);
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!isDate(expenseDate)) return json({ success: false, message: "تاریخ هزینه معتبر نیست." }, 422);
    if (!category) return json({ success: false, message: "دسته‌بندی هزینه الزامی است." }, 422);
    if (!Number.isInteger(amount) || amount <= 0) return json({ success: false, message: "مبلغ هزینه باید عدد صحیح بزرگ‌تر از صفر باشد." }, 422);
    if (category.length > 100 || description.length > 500 || note.length > 1000 || reference.length > 200) return json({ success: false, message: "طول یکی از فیلدها بیش از حد مجاز است." }, 422);

    const inserted = await db.prepare(`
      INSERT INTO finance_expenses (expense_date,category,description,amount,payment_method,reference,note)
      VALUES (?,?,?,?,?,?,?) RETURNING id
    `).bind(expenseDate, category, description, amount, method, reference || null, note || null).first<{ id:number }>();
    if (!inserted) return json({ success: false, message: "ثبت هزینه انجام نشد." }, 500);

    await recordAuditEvent(db, {
      actor: { type: "admin", label: "admin-api" },
      action: "finance_expense.create",
      entityType: "finance_expense",
      entityId: inserted.id,
      metadata: { expenseDate, category, amount, paymentMethod: method },
    });

    return json({ success: true, expenseId: inserted.id }, 201);
  } catch (error) {
    console.error("[admin/expenses] POST failed:", error);
    return json({ success: false, message: "ثبت هزینه با خطا مواجه شد." }, 500);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return json({ success: false, message: "شناسه هزینه معتبر نیست." }, 422);

    const existing = await db.prepare(`SELECT id,expense_date,category,amount FROM finance_expenses WHERE id=?`).bind(id).first<{id:number;expense_date:string;category:string;amount:number}>();
    if (!existing) return json({ success: false, message: "هزینه یافت نشد." }, 404);

    await db.prepare(`DELETE FROM finance_expenses WHERE id=?`).bind(id).run();
    await recordAuditEvent(db, {
      actor: { type: "admin", label: "admin-api" },
      action: "finance_expense.delete",
      entityType: "finance_expense",
      entityId: id,
      metadata: existing,
    });
    return json({ success: true, deletedId: id });
  } catch (error) {
    console.error("[admin/expenses] DELETE failed:", error);
    return json({ success: false, message: "حذف هزینه با خطا مواجه شد." }, 500);
  }
};
