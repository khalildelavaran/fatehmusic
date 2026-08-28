export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { buildContract } from "../../../scripts/registration/ContractTemplates";

async function requireAdmin(request: Request): Promise<Response | null> {
  return requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
}

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const result = await db.prepare("SELECT * FROM registrations ORDER BY created_at DESC LIMIT 300").all();
  return json({ success: true, registrations: result.results });
};

export const PATCH: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const { id, status } = await request.json() as { id?: number; status?: string };
  const allowed = ["pending", "contacted", "confirmed", "cancelled"];
  if (!id || !status || !allowed.includes(status)) return json({ success: false, message: "درخواست معتبر نیست." }, 422);
  await db.prepare("UPDATE registrations SET status=? WHERE id=?").bind(status, id).run();
  return json({ success: true });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  const browser = (env as any).BROWSER;
  if (!browser) return json({ success: false, message: "BROWSER binding تنظیم نشده است." }, 503);
  const { registration_id } = await request.json() as { registration_id?: number };
  if (!registration_id) return json({ success: false, message: "شناسه ثبت‌نام الزامی است." }, 422);
  const row = await db.prepare("SELECT * FROM registrations WHERE id=?").bind(registration_id).first<Record<string, any>>();
  if (!row) return json({ success: false, message: "ثبت‌نامی با این شناسه پیدا نشد." }, 404);
  const state: any = { selection: { instrument: { id: row.instrument_id ?? null, slug: row.instrument_slug, title: row.instrument_title, type: row.instrument_type ?? null }, instructor: { id: row.instructor_id ?? null, name: row.instructor_name, auto: false }, schedule: { id: row.schedule_id ?? null, weekday: row.schedule_weekday, sessionDuration: row.schedule_duration ?? null, classroom: row.schedule_classroom ?? null, classMode: row.schedule_class_mode ?? null, auto: false } }, student: { firstName: row.student_first_name ?? "", lastName: row.student_last_name ?? "", nationalCode: row.student_national_code ?? "", mobile: row.student_mobile ?? "", age: row.student_age ?? null, gender: row.student_gender ?? null, hasInstrument: row.student_has_instrument ?? null, fatherName: row.student_father_name ?? "", idIssuePlace: row.student_id_issue_place ?? "", birthYear: row.student_birth_year ?? null, occupation: row.student_occupation ?? "", address: row.student_address ?? "" }, trackingCode: row.tracking_code ?? null, term: row.term ?? null, completed: true };
  const contract = buildContract(state);
  if (!contract) return json({ success: false, message: "اطلاعات ثبت‌نام برای تولید قرارداد کافی نیست." }, 422);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#29261f;line-height:2;border:1px solid #b9973e;padding:10mm}h1{text-align:center;color:#8a691d;margin:0 0 8mm}h2{font-size:14px;color:#8a691d;border-bottom:1px solid #d8ccb0;padding-bottom:2mm}p{font-size:11px;text-align:justify}.sign{display:grid;grid-template-columns:1fr 1fr;gap:20mm;margin-top:12mm}.sign>div{text-align:center;border-top:1px solid #9f916f;padding-top:4mm;min-height:28mm}</style></head><body><div style="text-align:center;color:#8a691d;font-weight:bold">آموزشگاه موسیقی فاتح</div><h1>قرارداد هنرجویی</h1>${contract.blocks.map((b:any)=>`<section>${b.heading?`<h2>${esc(b.heading)}</h2>`:""}${b.paragraphs.map((p:string)=>`<p>${esc(p)}</p>`).join("")}</section>`).join("")}<div class="sign"><div>امضاء هنرجو (یا ولی و سرپرست)<br>${esc(contract.signature.studentName)}<br>تاریخ: ${esc(contract.signature.date)}</div><div>امضاء و مهر آموزشگاه</div></div></body></html>`;
  try {
    const result = await browser.quickAction("pdf", { html });
    const bytes: ArrayBuffer = result instanceof Response ? await result.arrayBuffer() : result;
    return new Response(bytes, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="contract-${row.tracking_code ?? row.id}.pdf"` } });
  } catch (err) {
    return json({ success: false, message: `تولید PDF شکست خورد: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
};
