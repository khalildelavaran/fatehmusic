export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json } from "../../../server/admin-auth";
import { listClasses } from "../../../server/classes";

const COLUMNS = [
  "id", "title", "courseTitle", "instructorName", "classType", "capacity",
  "enrolledCount", "level", "status", "startDate", "endDate", "createdAt",
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

  const { classes } = await listClasses(db, {
    search: url.searchParams.get("search"),
    status: url.searchParams.get("status"),
    instructorId: url.searchParams.get("instructorId") ? Number(url.searchParams.get("instructorId")) : undefined,
    courseId: url.searchParams.get("courseId") ? Number(url.searchParams.get("courseId")) : undefined,
    level: url.searchParams.get("level"),
    page: 1,
    pageSize: 5000,
  });

  const rows = [COLUMNS.join(",")];
  for (const cls of classes) {
    rows.push(COLUMNS.map((col) => csvEscape((cls as unknown as Record<string, unknown>)[col])).join(","));
  }
  const csv = "\uFEFF" + rows.join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="classes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
