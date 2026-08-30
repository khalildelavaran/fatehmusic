/*
====================================================
File: src/server/students.ts

Purpose:
Server-side logic for the "پرونده جامع هنرجو" (comprehensive
student file) -- Phase 1 of SCHOOL-MANAGEMENT-IMPLEMENTATION.md.

"students" (migrations/0011) is the one-row-per-person table this
project didn't have before: registrations is one row per *term*
(see migration 0009), so a person who has registered for three
terms has three registrations rows but exactly one students row.

Registrations and issued_certificates are still the source of truth
for term/contract/certificate history -- this module aggregates them
around a student, it does not duplicate them. Certificates are
joined by national_code (the same key src/pages/api/student/me.ts
already uses for the identical join), since issued_certificates has
no student_id column; registrations is joined by student_id, which
migration 0011 populates for every row that has a national code.
====================================================
*/

export interface StudentsEnv {
  DB: D1Database;
}

export const STUDENT_STATUSES = ["active", "inactive", "graduated"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export function isValidStudentStatus(value: unknown): value is StudentStatus {
  return typeof value === "string" && (STUDENT_STATUSES as readonly string[]).includes(value);
}

export interface StudentRecord {
  id: number;
  nationalCode: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  birthYear: number | null;
  phone: string;
  email: string;
  address: string;
  idIssuePlace: string;
  occupation: string;
  emergencyContact: string;
  notes: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

interface StudentRow {
  id: number;
  national_code: string;
  first_name: string;
  last_name: string;
  father_name: string;
  birth_year: number | null;
  phone: string;
  email: string;
  address: string;
  id_issue_place: string;
  occupation: string;
  emergency_contact: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapStudentRow(row: StudentRow): StudentRecord {
  return {
    id: row.id,
    nationalCode: row.national_code,
    firstName: row.first_name,
    lastName: row.last_name,
    fatherName: row.father_name,
    birthYear: row.birth_year,
    phone: row.phone,
    email: row.email,
    address: row.address,
    idIssuePlace: row.id_issue_place,
    occupation: row.occupation,
    emergencyContact: row.emergency_contact,
    notes: row.notes,
    status: isValidStudentStatus(row.status) ? row.status : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const STUDENT_COLUMNS =
  "id, national_code, first_name, last_name, father_name, birth_year, phone, email, address, id_issue_place, occupation, emergency_contact, notes, status, created_at, updated_at";

// ------------------------------------------------------------------
// List (Section 63 search, Section 64 filters, Section 65 pagination)
// ------------------------------------------------------------------

export interface StudentListParams {
  search?: string | null;
  status?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface NormalizedStudentListParams {
  search: string;
  status: StudentStatus | null;
  page: number;
  pageSize: number;
  offset: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Pure (no DB) so it can be unit tested on its own -- see students.test.ts. */
export function normalizeStudentListParams(params: StudentListParams): NormalizedStudentListParams {
  const search = (params.search ?? "").trim();
  const status = isValidStudentStatus(params.status) ? params.status : null;

  // Number.isFinite (not `|| fallback`) so an explicit 0 or negative value
  // is clamped by Math.max below instead of being treated as "not given"
  // and silently replaced by the default -- 0 is falsy but is not absent.
  const rawPage = Number.isFinite(params.page) ? Math.floor(params.page as number) : 1;
  const page = Math.max(1, rawPage);

  const rawPageSize = Number.isFinite(params.pageSize) ? Math.floor(params.pageSize as number) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));

  return { search, status, page, pageSize, offset: (page - 1) * pageSize };
}

export interface StudentListItem extends StudentRecord {
  termCount: number;
  latestRegistrationAt: string | null;
}

export interface StudentListResult {
  students: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listStudents(db: D1Database, rawParams: StudentListParams): Promise<StudentListResult> {
  const { search, status, page, pageSize, offset } = normalizeStudentListParams(rawParams);

  const where: string[] = [];
  const bind: unknown[] = [];

  if (status) {
    where.push("status = ?");
    bind.push(status);
  }

  if (search) {
    // Digits-only variant catches national-code/phone searches typed with
    // Persian digits or formatting (e.g. "0913-..."); the raw term still
    // matches names as typed.
    const digitsOnly = search.replace(/[^0-9\u06F0-\u06F9]/g, "").replace(/[\u06F0-\u06F9]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    where.push("(national_code LIKE ? OR phone LIKE ? OR (first_name || ' ' || last_name) LIKE ?)");
    bind.push(`%${digitsOnly || search}%`, `%${digitsOnly || search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await db
    .prepare(`SELECT COUNT(*) as count FROM students ${whereSql}`)
    .bind(...bind)
    .first<{ count: number }>();

  const rows = await db
    .prepare(
      `SELECT ${STUDENT_COLUMNS},
        (SELECT COUNT(*) FROM registrations r WHERE r.student_id = students.id) as term_count,
        (SELECT MAX(r.created_at) FROM registrations r WHERE r.student_id = students.id) as latest_registration_at
       FROM students
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...bind, pageSize, offset)
    .all<StudentRow & { term_count: number; latest_registration_at: string | null }>();

  return {
    students: rows.results.map((row) => ({ ...mapStudentRow(row), termCount: row.term_count, latestRegistrationAt: row.latest_registration_at })),
    total: totalRow?.count ?? 0,
    page,
    pageSize
  };
}

// ------------------------------------------------------------------
// Full profile (Section 6 -- personal info + registrations + certificates)
// ------------------------------------------------------------------

export interface StudentRegistrationSummary {
  id: number;
  trackingCode: string;
  term: number;
  instrumentTitle: string;
  instructorName: string;
  scheduleWeekday: string;
  status: string;
  createdAt: string;
}

export interface StudentCertificateSummary {
  id: number;
  certNumber: string;
  completionDateJalali: string;
  level: string | null;
  issuedAt: string;
}

export interface StudentProfile {
  student: StudentRecord;
  hasPortalAccount: boolean;
  registrations: StudentRegistrationSummary[];
  certificates: StudentCertificateSummary[];
}

export async function getStudentProfile(db: D1Database, id: number): Promise<StudentProfile | null> {
  const row = await db.prepare(`SELECT ${STUDENT_COLUMNS} FROM students WHERE id = ?`).bind(id).first<StudentRow>();
  if (!row) return null;
  const student = mapStudentRow(row);

  const [registrationsResult, certificatesResult, accountRow] = await Promise.all([
    db
      .prepare(
        `SELECT id, tracking_code, term, instrument_title, instructor_name, schedule_weekday, status, created_at
         FROM registrations WHERE student_id = ? ORDER BY created_at DESC, id DESC`
      )
      .bind(id)
      .all<{ id: number; tracking_code: string; term: number; instrument_title: string; instructor_name: string; schedule_weekday: string; status: string; created_at: string }>(),
    db
      .prepare(`SELECT id, cert_number, completion_date_jalali, level, issued_at FROM issued_certificates WHERE national_code = ? ORDER BY issued_at DESC, id DESC`)
      .bind(student.nationalCode)
      .all<{ id: number; cert_number: string; completion_date_jalali: string; level: string | null; issued_at: string }>(),
    db.prepare("SELECT id FROM student_accounts WHERE national_code = ? LIMIT 1").bind(student.nationalCode).first<{ id: number }>()
  ]);

  return {
    student,
    hasPortalAccount: Boolean(accountRow),
    registrations: registrationsResult.results.map((r) => ({
      id: r.id,
      trackingCode: r.tracking_code,
      term: r.term,
      instrumentTitle: r.instrument_title,
      instructorName: r.instructor_name,
      scheduleWeekday: r.schedule_weekday,
      status: r.status,
      createdAt: r.created_at
    })),
    certificates: certificatesResult.results.map((c) => ({
      id: c.id,
      certNumber: c.cert_number,
      completionDateJalali: c.completion_date_jalali,
      level: c.level,
      issuedAt: c.issued_at
    }))
  };
}

// ------------------------------------------------------------------
// Update (Admin edit of a student's own profile fields)
// ------------------------------------------------------------------

export interface StudentProfilePatch {
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  birthYear?: number | null;
  phone?: string;
  email?: string;
  address?: string;
  idIssuePlace?: string;
  occupation?: string;
  emergencyContact?: string;
  notes?: string;
  status?: string;
}

export interface PatchValidationResult {
  valid: boolean;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure validation, independent of the DB call -- see students.test.ts. */
export function validateStudentPatch(patch: StudentProfilePatch): PatchValidationResult {
  const errors: string[] = [];
  if (patch.email !== undefined && patch.email !== "" && !EMAIL_RE.test(patch.email)) {
    errors.push("ایمیل معتبر نیست.");
  }
  if (patch.status !== undefined && !isValidStudentStatus(patch.status)) {
    errors.push("وضعیت هنرجو معتبر نیست.");
  }
  if (patch.birthYear !== undefined && patch.birthYear !== null) {
    if (!Number.isInteger(patch.birthYear) || patch.birthYear < 1300 || patch.birthYear > 1500) {
      errors.push("سال تولد معتبر نیست.");
    }
  }
  return { valid: errors.length === 0, errors };
}

const PATCHABLE_COLUMNS: Record<keyof StudentProfilePatch, string> = {
  firstName: "first_name",
  lastName: "last_name",
  fatherName: "father_name",
  birthYear: "birth_year",
  phone: "phone",
  email: "email",
  address: "address",
  idIssuePlace: "id_issue_place",
  occupation: "occupation",
  emergencyContact: "emergency_contact",
  notes: "notes",
  status: "status"
};

export async function updateStudentProfile(db: D1Database, id: number, patch: StudentProfilePatch): Promise<boolean> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [keyof StudentProfilePatch, unknown][];
  if (entries.length === 0) return true;

  const setClauses = entries.map(([key]) => `${PATCHABLE_COLUMNS[key]} = ?`);
  const bind = entries.map(([, value]) => value);

  const result = await db
    .prepare(`UPDATE students SET ${setClauses.join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...bind, id)
    .run();

  return result.meta.rows_written > 0 || result.success;
}

// ------------------------------------------------------------------
// Find-or-create (called from /api/register.ts on every new registration
// so "students" never drifts out of sync with new signups -- Section 2's
// "don't create a duplicate model" applies just as much to duplicate
// *rows* going forward as it does to duplicate tables today.)
// ------------------------------------------------------------------

export interface RegistrationStudentInput {
  nationalCode: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  birthYear: number | null;
  phone: string;
  address: string;
  idIssuePlace: string;
  occupation: string;
}

export async function findOrCreateStudentForRegistration(db: D1Database, input: RegistrationStudentInput): Promise<number | null> {
  if (!input.nationalCode) return null;

  const existing = await db.prepare("SELECT id FROM students WHERE national_code = ?").bind(input.nationalCode).first<{ id: number }>();

  if (existing) {
    // Refresh the mutable contact/personal fields with this term's values,
    // same "latest registration wins" rule migration 0011 used to backfill.
    await db
      .prepare(
        `UPDATE students SET first_name=?, last_name=?, father_name=?, birth_year=?, phone=?, address=?, id_issue_place=?, occupation=?, updated_at=datetime('now') WHERE id=?`
      )
      .bind(input.firstName, input.lastName, input.fatherName, input.birthYear, input.phone, input.address, input.idIssuePlace, input.occupation, existing.id)
      .run();
    return existing.id;
  }

  const inserted = await db
    .prepare(
      `INSERT INTO students (national_code, first_name, last_name, father_name, birth_year, phone, address, id_issue_place, occupation)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .bind(input.nationalCode, input.firstName, input.lastName, input.fatherName, input.birthYear, input.phone, input.address, input.idIssuePlace, input.occupation)
    .run();

  return typeof inserted.meta.last_row_id === "number" ? inserted.meta.last_row_id : null;
}
