export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireRole, ROLES, json, type AdminEnv } from "../../../server/admin-auth";
import { buildContract, type RegistrationState } from "../../../scripts/registration/ContractTemplates";
import { getCurrentJalaliYear } from "../../../utils/format-date";

interface RegistrationRow {
  id: number;
  tracking_code: string;
  instrument_title: string;
  instrument_slug: string;
  instrument_type: string | null;
  instructor_name: string;
  instructor_id: number | null;
  schedule_id: number | null;
  schedule_weekday: string | null;
  schedule_duration: number | null;
  schedule_classroom: string | number | null;
  schedule_class_mode: string | null;
  student_first_name: string;
  student_last_name: string;
  student_national_code: string | null;
  student_mobile: string;
  student_age: number | null;
  student_gender: string | null;
  student_has_instrument: string | null;
  student_father_name: string | null;
  student_id_issue_place: string | null;
  student_birth_year: number | null;
  student_occupation: string | null;
  student_address: string | null;
}

function normalizeGender(value: string | null): RegistrationState["student"]["gender"] {
  const gender = (value ?? "").trim().toLowerCase();
  if (["female", "زن", "دختر"].includes(gender)) return "female";
  if (["male", "مرد", "پسر"].includes(gender)) return "male";
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderContractHtml(contract: NonNullable<ReturnType<typeof buildContract>>, registration: RegistrationRow): string {
  const blocks = contract.blocks.map((block) => `
    <section class="contract-block">
      ${block.heading ? `<h2>${escapeHtml(block.heading)}</h2>` : ""}
      ${block.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
    </section>`).join("");

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&family=Lalezar&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 13mm 14mm 16mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #222; font-family: 'Vazirmatn', sans-serif; }
body { font-size: 11.5pt; line-height: 2.05; }
.sheet { min-height: 267mm; border: 1.2px solid #b89435; position: relative; padding: 15mm 13mm 12mm; }
.sheet::before { content: ''; position: absolute; inset: 3mm; border: .45px solid #d8c58a; pointer-events: none; }
.header { text-align: center; border-bottom: 1px solid #d5bd76; padding-bottom: 6mm; margin-bottom: 7mm; }
.brand { color: #a57c18; font-weight: 700; font-size: 12pt; letter-spacing: .2px; }
.title { margin: 2mm 0 0; font-family: 'Lalezar','Vazirmatn',sans-serif; font-size: 25pt; color: #171717; }
.meta { display: flex; justify-content: space-between; gap: 8mm; margin-top: 3mm; color: #666; font-size: 9.5pt; }
.contract-block { margin: 0 0 4mm; page-break-inside: avoid; }
.contract-block h2 { margin: 0 0 1.5mm; font-size: 12pt; color: #8b6815; font-weight: 700; }
.contract-block p { margin: 0 0 2mm; text-align: justify; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 22mm; margin-top: 11mm; page-break-inside: avoid; }
.signature { text-align: center; padding-top: 8mm; border-top: 1px solid #999; }
.signature strong { display: block; margin-top: 2mm; font-size: 11pt; }
.footer { margin-top: 8mm; padding-top: 3mm; border-top: .6px solid #d7c486; text-align: center; color: #777; font-size: 8.5pt; }
</style>
</head>
<body>
<div class="sheet">
  <header class="header">
    <div class="brand">آموزشگاه موسیقی فاتح</div>
    <div class="title">قرارداد هنرجویی</div>
    <div class="meta"><span>کد پیگیری: ${escapeHtml(registration.tracking_code)}</span><span>تاریخ تنظیم: ${escapeHtml(contract.signature.date)}</span></div>
  </header>
  ${blocks}
  <div class="signatures">
    <div class="signature">امضای هنرجو<strong>${escapeHtml(contract.signature.studentName)}</strong></div>
    <div class="signature">مدیر آموزشگاه<strong>رضا فاتح</strong></div>
  </div>
  <div class="footer">آموزشگاه موسیقی فاتح · شوشتر · قرارداد ثبت‌نام هنرجو</div>
</div>
</body>
</html>`;
}

export const POST: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env as AdminEnv, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  const browser = (env as unknown as { BROWSER?: unknown }).BROWSER;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  if (!browser) return json({ success: false, message: "BROWSER binding تنظیم نشده است." }, 503);

  const body = (await request.json().catch(() => ({}))) as { registration_id?: number };
  if (!body.registration_id) return json({ success: false, message: "شناسه ثبت‌نام الزامی است." }, 422);

  const registration = await db.prepare(`
    SELECT id, tracking_code, instrument_title, instrument_slug, instrument_type,
           instructor_name, instructor_id, schedule_id, schedule_weekday, schedule_duration,
           schedule_classroom, schedule_class_mode, student_first_name, student_last_name,
           student_national_code, student_mobile, student_age, student_gender,
           student_has_instrument, student_father_name, student_id_issue_place,
           student_birth_year, student_occupation, student_address
    FROM registrations WHERE id = ?
  `).bind(body.registration_id).first<RegistrationRow>();

  if (!registration) return json({ success: false, message: "ثبت‌نامی با این شناسه پیدا نشد." }, 404);

  const priorCount = registration.student_national_code
    ? await db.prepare("SELECT COUNT(*) AS count FROM registrations WHERE student_national_code = ? AND id <= ?")
        .bind(registration.student_national_code, registration.id).first<{ count: number }>()
    : null;
  const term = Math.max(1, Number(priorCount?.count ?? 1));

  const state: RegistrationState = {
    currentStep: "success",
    selection: {
      instrument: { id: registration.id, slug: registration.instrument_slug, title: registration.instrument_title, type: registration.instrument_type },
      instructor: { id: registration.instructor_id, name: registration.instructor_name, auto: false },
      schedule: {
        id: registration.schedule_id,
        weekday: registration.schedule_weekday,
        sessionDuration: registration.schedule_duration,
        classroom: registration.schedule_classroom,
        classMode: registration.schedule_class_mode,
        auto: false
      }
    },
    student: {
      firstName: registration.student_first_name,
      lastName: registration.student_last_name,
      nationalCode: registration.student_national_code ?? "",
      mobile: registration.student_mobile,
      age: registration.student_age,
      gender: normalizeGender(registration.student_gender),
      hasInstrument: registration.student_has_instrument === "yes" ? "yes" : registration.student_has_instrument === "no" ? "no" : null,
      fatherName: registration.student_father_name ?? "",
      idIssuePlace: registration.student_id_issue_place ?? "",
      birthYear: registration.student_birth_year || getCurrentJalaliYear() - (registration.student_age ?? 0),
      occupation: registration.student_occupation ?? "",
      address: registration.student_address ?? ""
    },
    trackingCode: registration.tracking_code,
    term,
    completed: true
  };

  const contract = buildContract(state);
  if (!contract) return json({ success: false, message: "اطلاعات ثبت‌نام برای تولید قرارداد کامل نیست." }, 422);

  try {
    const html = renderContractHtml(contract, registration);
    const pdfResult = await (browser as any).quickAction("pdf", { html });
    const pdfBytes: ArrayBuffer = pdfResult instanceof Response ? await pdfResult.arrayBuffer() : pdfResult;
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contract-${registration.tracking_code}.pdf"`
      }
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ success: false, message: `تولید PDF قرارداد شکست خورد: ${detail}` }, 500);
  }
};
