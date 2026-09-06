export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json } from "../../../server/admin-auth";
import { listStudents } from "../../../server/students";

const COLUMNS = [
  "id", "nationalCode", "firstName", "lastName", "fatherName", "birthYear",
  "phone", "email", "address", "occupation", "status", "createdAt",
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

  const { students } = await listStudents(db, {
    search: url.searchParams.get("search"),
    status: url.searchParams.get("status"),
    page: 1,
    pageSize: 5000,
  });

  const rows = [COLUMNS.join(",")];
  for (const student of students) {
    rows.push(COLUMNS.map((col) => csvEscape((student as unknown as Record<string, unknown>)[col])).join(","));
  }
  const csv = "\uFEFF" + rows.join("\r\n"); // BOM so Excel opens Persian text as UTF-8 correctly

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
