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
  const blocks = contract.blocks.map((block, index) => `
    <section class="contract-block${index === 0 ? " intro-block" : ""}${block.heading?.startsWith("ماده ۳") ? " tuition-block" : ""}">
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
@page { size: A4; margin: 10mm 12mm 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #292722; font-family: 'Vazirmatn', sans-serif; }
body { font-size: 10.8pt; line-height: 1.9; }
.sheet { min-height: 275mm; position: relative; overflow: hidden; border: 1.1px solid #b99742; background: #fffefa; padding: 10mm 11mm 9mm; }
.sheet::before { content: ''; position: absolute; inset: 2.5mm; border: .45px solid #d9c98f; pointer-events: none; }
.sheet::after { content: '♫  ♪  ♩'; position: absolute; left: 5mm; top: 49mm; color: rgba(185,151,66,.10); font-size: 28pt; transform: rotate(-10deg); pointer-events: none; }
.header { position: relative; text-align: center; padding: 3mm 8mm 5mm; margin-bottom: 5mm; border-bottom: 1px solid #d8c68c; }
.header::before { content: '✦'; position: absolute; right: 12mm; top: 4mm; color: #b99742; font-size: 17pt; }
.header::after { content: '✦'; position: absolute; left: 12mm; top: 4mm; color: #b99742; font-size: 17pt; }
.brand { color: #9b761f; font-weight: 700; font-size: 12pt; }
.title { margin: 1mm 0 0; font-family: 'Lalezar','Vazirmatn',sans-serif; font-size: 24pt; color: #171717; letter-spacing: .1px; }
.subtitle { margin-top: 1mm; color: #756b58; font-size: 8.8pt; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 4mm; }
.meta-item { padding: 2.3mm 4mm; border: 1px solid #ded4b9; border-radius: 5px; background: #fffdf6; color: #675e4e; font-size: 8.8pt; }
.meta-item strong { color: #80631d; margin-inline-start: 2mm; }
.contract-block { position: relative; margin: 0 0 3.2mm; padding: 3.5mm 5mm 3mm; border: 1px solid #e4dcc7; border-radius: 5px; background: rgba(255,255,255,.78); page-break-inside: avoid; }
.contract-block h2 { margin: 0 0 1.5mm; padding-bottom: 1.5mm; border-bottom: 1px solid #eee7d5; color: #7f611b; font-size: 11.2pt; font-weight: 700; }
.contract-block h2::before { content: '◆'; display: inline-block; margin-left: 2.5mm; color: #b99742; font-size: 7pt; vertical-align: 1px; }
.contract-block p { margin: 0 0 1.4mm; text-align: justify; }
.contract-block p:last-child { margin-bottom: 0; }
.intro-block { border: 0; background: transparent; padding: 1mm 8mm 3mm; text-align: center; }
.intro-block p { text-align: center; color: #655a48; font-size: 9.4pt; }
.intro-block p:first-child { color: #8c6b1f; font-weight: 700; }
.tuition-block { border-color: #cdb875; background: linear-gradient(90deg, #fffdf5, #fbf5e3); box-shadow: inset 3px 0 0 #b99742; }
.tuition-block h2 { color: #725617; }
.signatures { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 35mm; margin-top: 8mm; padding-top: 2mm; page-break-inside: avoid; }
.signature { min-height: 30mm; position: relative; padding-top: 8mm; text-align: center; color: #635b4d; font-size: 9pt; }
.signature::before { content: ''; position: absolute; top: 4mm; left: 15%; right: 15%; border-top: 1px solid #b9ad90; }
.signature strong { display: block; margin-top: 2mm; color: #292722; font-size: 10.2pt; }
.stamp-space { position: absolute; width: 25mm; height: 25mm; right: 50%; top: 5mm; transform: translateX(50%); border: 1px dashed #c8b98f; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #a79873; font-size: 7pt; background: rgba(255,253,245,.72); }
.footer { margin-top: 2mm; padding-top: 2.5mm; border-top: .6px solid #d7c486; text-align: center; color: #877c68; font-size: 7.7pt; }
@media print {
  .sheet { box-shadow: none; }
}
</style>
</head>
<body>
<div class="sheet">
  <header class="header">
    <div class="brand">آموزشگاه موسیقی فاتح</div>
    <div class="title">قرارداد هنرجویی</div>
    <div class="subtitle">قرارداد رسمی ثبت‌نام و تعهدات آموزشی</div>
    <div class="meta">
      <div class="meta-item"><strong>کد پیگیری</strong>${escapeHtml(registration.tracking_code)}</div>
      <div class="meta-item"><strong>تاریخ تنظیم</strong>${escapeHtml(contract.signature.date)}</div>
    </div>
  </header>
  ${blocks}
  <div class="signatures">
    <div class="signature">امضای هنرجو / ولی و سرپرست<strong>${escapeHtml(contract.signature.studentName)}</strong></div>
    <div class="signature">مدیر آموزشگاه<strong>رضا فاتح</strong></div>
    <div class="stamp-space">محل مهر آموزشگاه</div>
  </div>
  <div class="footer">آموزشگاه موسیقی فاتح · شوشتر · قرارداد ثبت‌نام هنرجو · این نسخه جهت چاپ و امضا تهیه شده است.</div>
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
