export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json, type AdminEnv } from "../../../server/admin-auth";
import { getStudentSession, type StudentEnv } from "../../../server/student-auth";
import { loadRegistrationForContract, generateContractPdf } from "../../../server/contracts/generate";

async function generate(request: Request, registrationId: number) {
  const adminDenied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN, ROLES.REGISTRAR]);
  const student = await getStudentSession(request, env as StudentEnv);
  if (adminDenied && !student) return adminDenied;

  const db = env.DB;
  const browser = (env as unknown as { BROWSER?: unknown }).BROWSER;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  if (!browser) return json({ success: false, message: "BROWSER binding تنظیم نشده است." }, 503);
  if (!Number.isInteger(registrationId) || registrationId <= 0) return json({ success: false, message: "شناسه ثبت‌نام نامعتبر است." }, 422);

  let row;
  try {
    row = await loadRegistrationForContract(db, { registrationId });
  } catch (e) {
    return json({ success: false, message: e instanceof Error ? e.message : String(e) }, Number((e as any)?.status) || 500);
  }

  if (student && row.student_national_code !== student.nationalCode) {
    return json({ success: false, message: "دسترسی به این قرارداد مجاز نیست." }, 403);
  }

  try {
    return await generateContractPdf(db, browser, row);
  } catch (e) {
    return json({ success: false, message: `تولید PDF قرارداد شکست خورد: ${e instanceof Error ? e.message : String(e)}` }, Number((e as any)?.status) || 500);
  }
}

export const GET: APIRoute = async ({ request, url }) =>
  generate(request, Number(url.searchParams.get("registration_id") ?? url.searchParams.get("id") ?? "0"));

export const POST: APIRoute = async ({ request }) => {
  let id = 0;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { registration_id?: number; id?: number };
    id = Number(body.registration_id ?? body.id ?? 0);
  } else {
    const form = await request.formData().catch(() => null);
    const raw = form?.get("registration_id") ?? form?.get("id");
    id = Number(raw ?? 0);
  }
  return generate(request, id);
};
