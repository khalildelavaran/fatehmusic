export const prerender = false;
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import {
  getStudentReport,
  getInstructorReport,
  getClassReport,
  getFinanceReport,
  getEducationalReport,
} from "../../../server/admin-reports";

const REPORT_TYPES = ["students", "instructors", "classes", "finance", "educational"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function isReportType(value: string | null): value is ReportType {
  return !!value && (REPORT_TYPES as readonly string[]).includes(value);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (!isReportType(type)) {
    return json({ success: false, message: `نوع گزارش معتبر نیست. مقادیر مجاز: ${REPORT_TYPES.join(", ")}` }, 422);
  }

  const today = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);
  const from = url.searchParams.get("from") ?? `${today.slice(0, 4)}-01-01`;
  const to = url.searchParams.get("to") ?? today;

  try {
    switch (type) {
      case "students":
        return json({ success: true, type, report: await getStudentReport(db, from, to) });
      case "instructors":
        return json({ success: true, type, report: await getInstructorReport(db) });
      case "classes":
        return json({ success: true, type, report: await getClassReport(db, today) });
      case "finance":
        return json({ success: true, type, report: await getFinanceReport(db, today) });
      case "educational":
        return json({ success: true, type, report: await getEducationalReport(db) });
    }
  } catch (error) {
    console.error(`[admin/reports:${type}]`, error);
    return json({ success: false, message: "دریافت گزارش با خطا مواجه شد." }, 500);
  }
};
