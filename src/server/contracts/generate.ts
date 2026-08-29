/*
====================================================
File: src/server/contracts/generate.ts

Purpose:
D1 row -> ContractResult -> real PDF (via Cloudflare Browser Run,
env.BROWSER.quickAction("pdf", ...)) for "قرارداد هنرجویی". Mirrors
the src/server/certificates/generate.ts + template.ts split already
used for certificates, so the two document types now follow the
same shape.

Three callers, one pipeline:
- src/pages/api/admin/contract-generate.ts (admin panel + student
  portal, both auth'd by session -- registration_id lookup)
- src/pages/api/contract-pdf.ts (the wizard's own Success step,
  right after a fresh registration, before any login exists --
  tracking_code lookup; see that file for why knowing the code is
  itself sufficient proof)

Auth is each route file's job, not this module's -- it only takes
an already-resolved lookup key and loads the matching row. Errors
are thrown as `Object.assign(new Error(...), {status})`, the same
convention certificates/generate.ts uses, so route handlers can do
`Number((e as any)?.status) || 500`.

Architecture:
- No DOM access. db/browser are passed in loosely typed (matching
  certificates/generate.ts) rather than importing D1Database/etc.
====================================================
*/

import { buildContract } from "../../scripts/registration/ContractTemplates";
import type { RegistrationState } from "../../scripts/registration/RegistrationStore";
import { buildContractHtml } from "./template";

type Db = any;
type Browser = any;

export interface ContractLookup {
  registrationId?: number;
  trackingCode?: string;
}

interface RegistrationRow {
  id: number;
  tracking_code: string;
  instrument_id: number | null;
  instrument_title: string;
  instrument_slug: string;
  instructor_id: number | null;
  instructor_name: string;
  schedule_id: number | null;
  schedule_weekday: string | null;
  schedule_duration: number | null;
  schedule_classroom: string | number | null;
  student_first_name: string;
  student_last_name: string;
  student_national_code: string | null;
  student_mobile: string;
  student_age: number | null;
  student_gender: string | null;
  has_instrument: string | null;
  student_father_name: string | null;
  student_id_issue_place: string | null;
  student_birth_year: number | null;
  student_occupation: string | null;
  student_address: string | null;
}

// Column list intentionally explicit (not SELECT *) so a schema/name
// mismatch fails loudly at query time instead of silently landing as
// `undefined` on the row -- verified 1:1 against migrations/0001,
// 0007, and 0008 rather than assumed. Two fields the old, pre-unification
// code referenced (instrument_type, schedule_class_mode) turned out not
// to exist as columns under any name; buildContract() never reads
// selection.instrument.type or selection.schedule.classMode, so those
// two are passed through as null in toRegistrationState() below rather
// than invented as columns.
const ROW_COLUMNS =
  "id,tracking_code,instrument_id,instrument_title,instrument_slug,instructor_id,instructor_name,schedule_id,schedule_weekday,schedule_duration,schedule_classroom,student_first_name,student_last_name,student_national_code,student_mobile,student_age,student_gender,has_instrument,student_father_name,student_id_issue_place,student_birth_year,student_occupation,student_address";

function normalizeGender(value: string | null): RegistrationState["student"]["gender"] {
  const g = (value ?? "").trim().toLowerCase();
  if (["female", "زن", "دختر"].includes(g)) return "female";
  if (["male", "مرد", "پسر"].includes(g)) return "male";
  return null;
}

/** Loads a registration by numeric id (admin panel / student portal) or by tracking code (the wizard's own Success step, which never has the numeric id -- see api/register.ts's response). */
export async function loadRegistrationForContract(db: Db, lookup: ContractLookup): Promise<RegistrationRow> {
  const row = lookup.registrationId
    ? await db.prepare(`SELECT ${ROW_COLUMNS} FROM registrations WHERE id=?`).bind(lookup.registrationId).first<RegistrationRow>()
    : lookup.trackingCode
      ? await db.prepare(`SELECT ${ROW_COLUMNS} FROM registrations WHERE tracking_code=?`).bind(lookup.trackingCode).first<RegistrationRow>()
      : null;

  if (!row) throw Object.assign(new Error("ثبت‌نامی با این مشخصات پیدا نشد."), { status: 404 });
  return row;
}

/** Same "how many prior registrations does this national code have" count api/admin/contract-generate.ts always used, now shared. */
async function computeTerm(db: Db, row: RegistrationRow): Promise<number> {
  const prior = row.student_national_code
    ? await db
        .prepare("SELECT COUNT(*) AS count FROM registrations WHERE student_national_code=? AND id<=?")
        .bind(row.student_national_code, row.id)
        .first<{ count: number }>()
    : null;
  return Math.max(1, Number(prior?.count ?? 1));
}

function toRegistrationState(row: RegistrationRow, term: number): RegistrationState {
  return {
    currentStep: "success",
    selection: {
      instrument: { id: row.instrument_id, slug: row.instrument_slug, title: row.instrument_title, type: null },
      instructor: { id: row.instructor_id, name: row.instructor_name, auto: false },
      schedule: {
        id: row.schedule_id,
        weekday: row.schedule_weekday,
        sessionDuration: row.schedule_duration,
        classroom: row.schedule_classroom,
        classMode: null,
        auto: false
      }
    },
    student: {
      firstName: row.student_first_name,
      lastName: row.student_last_name,
      nationalCode: row.student_national_code ?? "",
      mobile: row.student_mobile,
      age: row.student_age,
      gender: normalizeGender(row.student_gender),
      hasInstrument: row.has_instrument === "yes" ? "yes" : row.has_instrument === "no" ? "no" : null,
      fatherName: row.student_father_name ?? "",
      idIssuePlace: row.student_id_issue_place ?? "",
      birthYear: row.student_birth_year,
      occupation: row.student_occupation ?? "",
      address: row.student_address ?? ""
    },
    trackingCode: row.tracking_code,
    term,
    completed: true
  };
}

/** Renders the already-loaded row to a real PDF via Cloudflare Browser Run. Throws (status-tagged) if BROWSER is missing or the row's data can't fill the contract. */
export async function generateContractPdf(db: Db, browser: Browser, row: RegistrationRow): Promise<Response> {
  if (!browser) throw Object.assign(new Error("BROWSER binding تنظیم نشده است."), { status: 503 });

  const term = await computeTerm(db, row);
  const contract = buildContract(toRegistrationState(row, term));
  if (!contract) throw Object.assign(new Error("اطلاعات ثبت‌نام برای تولید قرارداد کامل نیست."), { status: 422 });

  const html = buildContractHtml(contract, { trackingCode: row.tracking_code });
  const pdf = await browser.quickAction("pdf", {
    html,
    pdfOptions: {
      format: "a4",
      landscape: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      scale: 1
    }
  });
  const bytes: ArrayBuffer = pdf instanceof Response ? await pdf.arrayBuffer() : pdf;

  return new Response(bytes, {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="contract-${row.tracking_code}.pdf"` }
  });
}
