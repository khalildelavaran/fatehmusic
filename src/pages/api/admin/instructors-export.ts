export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json } from "../../../server/admin-auth";
import { listInstructors } from "../../../server/instructors";

const COLUMNS = [
  "id", "firstName", "lastName", "phone", "email", "specialty", "payPercentage", "isActive", "createdAt",
] as const;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const GET: APIRoute = async ({ request, url }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const { instructors } = await listInstructors(db, {
    search: url.searchParams.get("search"),
    status: url.searchParams.get("status"),
    page: 1,
    pageSize: 5000,
  });

  const rows = [COLUMNS.join(",")];
  for (const instructor of instructors) {
    rows.push(COLUMNS.map((col) => csvEscape((instructor as unknown as Record<string, unknown>)[col])).join(","));
  }
  const csv = "\uFEFF" + rows.join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="instructors-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
