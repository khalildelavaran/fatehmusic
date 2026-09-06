export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json } from "../../../server/admin-auth";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Exports the raw payments ledger (not the aggregate finance report
 * numbers themselves, which are single totals with nothing to tabulate)
 * for the given date range, since that is what an admin actually wants
 * in a spreadsheet: every payment row with its invoice/enrollment context.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const from = url.searchParams.get("from") ?? `${new Date().toISOString().slice(0, 4)}-01-01`;
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const rows = await db
    .prepare(
      `SELECT p.id, p.paid_at, p.amount, p.method, p.reference, i.status AS invoice_status,
              TRIM(s.first_name || ' ' || s.last_name) AS student_name, c.title AS class_title
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN enrollment_terms et ON et.id = i.enrollment_term_id
       JOIN enrollments e ON e.id = et.enrollment_id
       JOIN students s ON s.id = e.student_id
       JOIN classes c ON c.id = e.class_id
       WHERE date(p.paid_at) BETWEEN date(?) AND date(?)
       ORDER BY p.paid_at DESC`,
    )
    .bind(from, to)
    .all();

  const columns = ["id", "paid_at", "amount", "method", "reference", "invoice_status", "student_name", "class_title"] as const;
  const csvRows = [columns.join(",")];
  for (const row of rows.results ?? []) {
    csvRows.push(columns.map((col) => csvEscape((row as Record<string, unknown>)[col])).join(","));
  }
  const csv = "\uFEFF" + csvRows.join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${from}-to-${to}.csv"`,
    },
  });
};
