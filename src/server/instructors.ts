import { instructors as staticInstructors } from "../data/instructors.js";

export interface InstructorsEnv {
  DB: D1Database;
}

export interface InstructorRecord {
  id: number;
  slug: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  specialty: string;
  instruments: string[];
  biography: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InstructorRow {
  id: number;
  slug: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  specialty: string;
  instruments: string;
  biography: string;
  notes: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function parseInstruments(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapInstructorRow(row: InstructorRow): InstructorRecord {
  return {
    id: row.id,
    slug: row.slug,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    specialty: row.specialty,
    instruments: parseInstruments(row.instruments),
    biography: row.biography,
    notes: row.notes,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaticInstructor(item: any): InstructorRecord {
  const fullName = typeof item.name === "string" ? item.name.trim() : "";
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = item.identity?.firstName ?? nameParts[0] ?? "";
  const lastName = item.identity?.lastName ?? nameParts.slice(1).join(" ");

  return {
    id: Number(item.id),
    slug: item.slug ?? "",
    firstName,
    lastName,
    phone: item.phone ?? "",
    email: item.email ?? "",
    specialty: item.position ?? item.content?.excerpt ?? "",
    instruments: Array.isArray(item.relations?.courses) ? item.relations.courses : [],
    biography: item.content?.biography ?? "",
    notes: "",
    isActive: item.active !== false,
    createdAt: "",
    updatedAt: "",
  };
}

const INSTRUCTOR_COLUMNS = "id, slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active, created_at, updated_at";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface InstructorListParams {
  search?: string | null;
  status?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface NormalizedInstructorListParams {
  search: string;
  isActive: boolean | null;
  page: number;
  pageSize: number;
  offset: number;
}

export function normalizeInstructorListParams(params: InstructorListParams): NormalizedInstructorListParams {
  const search = (params.search ?? "").trim();
  let isActive: boolean | null = null;
  if (params.status === "active") isActive = true;
  if (params.status === "inactive") isActive = false;

  const rawPage = Number.isFinite(params.page) ? Math.floor(params.page as number) : 1;
  const rawPageSize = Number.isFinite(params.pageSize) ? Math.floor(params.pageSize as number) : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, rawPage);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));

  return {
    search,
    isActive,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export interface InstructorListItem extends InstructorRecord {
  studentCount: number;
}

export interface InstructorListResult {
  instructors: InstructorListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listInstructors(db: D1Database, rawParams: InstructorListParams): Promise<InstructorListResult> {
  const { search, isActive, page, pageSize, offset } = normalizeInstructorListParams(rawParams);
  const where: string[] = [];
  const bind: unknown[] = [];

  if (isActive !== null) {
    where.push("is_active = ?");
    bind.push(isActive ? 1 : 0);
  }

  if (search) {
    where.push("((first_name || ' ' || last_name) LIKE ? OR specialty LIKE ? OR phone LIKE ?)");
    bind.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS count FROM instructors ${whereSql}`)
      .bind(...bind)
      .first<{ count: number }>();

    const rows = await db
      .prepare(`SELECT ${INSTRUCTOR_COLUMNS}, (SELECT COUNT(DISTINCT r.student_national_code) FROM registrations r WHERE r.instructor_id = instructors.id AND r.student_national_code IS NOT NULL AND r.student_national_code != '') AS student_count FROM instructors ${whereSql} ORDER BY is_active DESC, first_name, last_name LIMIT ? OFFSET ?`)
      .bind(...bind, pageSize, offset)
      .all<InstructorRow & { student_count: number }>();

    if (rows.results.length > 0) {
      return {
        instructors: rows.results.map((row) => ({ ...mapInstructorRow(row), studentCount: row.student_count })),
        total: totalRow?.count ?? 0,
        page,
        pageSize,
      };
    }
  } catch (error) {
    console.error("[admin/instructors] list query failed", error);
  }

  const filtered = staticInstructors.filter((item: any) => {
    const name = item.name ?? `${item.identity?.firstName ?? ""} ${item.identity?.lastName ?? ""}`.trim();
    const matchesSearch = !search || name.includes(search) || (item.position ?? "").includes(search);
    const matchesStatus = isActive === null || item.active === isActive;
    return matchesSearch && matchesStatus;
  });

  return {
    instructors: filtered.slice(offset, offset + pageSize).map((item: any) => ({
      ...mapStaticInstructor(item),
      studentCount: 0,
    })),
    total: filtered.length,
    page,
    pageSize,
  };
}

export interface InstructorStudentSummary {
  studentId: number;
  firstName: string;
  lastName: string;
  nationalCode: string;
  studentStatus: string;
  course: string;
  termCount: number;
  startDate: string;
  lastActivity: string;
}

export interface InstructorProfile {
  instructor: InstructorRecord;
  students: InstructorStudentSummary[];
}

export async function getInstructorProfile(db: D1Database, id: number): Promise<InstructorProfile | null> {
  let instructor: InstructorRecord | null = null;

  try {
    const row = await db
      .prepare(`SELECT ${INSTRUCTOR_COLUMNS} FROM instructors WHERE id = ?`)
      .bind(id)
      .first<InstructorRow>();

    if (row) instructor = mapInstructorRow(row);
  } catch (error) {
    console.error("[admin/instructors] profile instructor query failed", error);
  }

  if (!instructor) {
    const item = staticInstructors.find((entry: any) => Number(entry.id) === id);
    if (item) instructor = mapStaticInstructor(item);
  }

  if (!instructor) return null;

  const students: InstructorStudentSummary[] = [];

  try {
    const result = await db
      .prepare(`SELECT s.id AS student_id, s.first_name, s.last_name, s.national_code, s.status AS student_status, r.instrument_title AS course, COUNT(*) AS term_count, MIN(r.created_at) AS start_date, MAX(r.created_at) AS last_activity FROM registrations r JOIN students s ON s.id = r.student_id WHERE r.instructor_id = ? GROUP BY s.id, r.instrument_title ORDER BY last_activity DESC`)
      .bind(id)
      .all<{
        student_id: number;
        first_name: string;
        last_name: string;
        national_code: string;
        student_status: string;
        course: string;
        term_count: number;
        start_date: string;
        last_activity: string;
      }>();

    for (const student of result.results) {
      students.push({
        studentId: student.student_id,
        firstName: student.first_name,
        lastName: student.last_name,
        nationalCode: student.national_code,
        studentStatus: student.student_status,
        course: student.course,
        termCount: student.term_count,
        startDate: student.start_date,
        lastActivity: student.last_activity,
      });
    }
  } catch (error) {
    console.error("[admin/instructors] profile student query failed", error);
  }

  return { instructor, students };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InstructorInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  specialty?: string;
  instruments?: string[];
  biography?: string;
  notes?: string;
  isActive?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateInstructorInput(input: InstructorInput, options: { isCreate?: boolean } = {}): ValidationResult {
  const errors: string[] = [];
  const isCreate = options.isCreate === true;

  if (isCreate && !input.firstName?.trim()) errors.push("نام مدرس الزامی است.");
  if (isCreate && !input.lastName?.trim()) errors.push("نام خانوادگی مدرس الزامی است.");
  if (input.email !== undefined && input.email !== "" && !EMAIL_RE.test(input.email)) errors.push("ایمیل معتبر نیست.");
  if (input.instruments !== undefined && !Array.isArray(input.instruments)) errors.push("فهرست سازهای آموزشی معتبر نیست.");

  return { valid: errors.length === 0, errors };
}

function slugify(firstName: string, lastName: string): string {
  const base = `${firstName}-${lastName}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, "");
  return base || `instructor-${Date.now()}`;
}

export async function createInstructor(db: D1Database, input: InstructorInput): Promise<number> {
  const inserted = await db
    .prepare(`INSERT INTO instructors (slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active) VALUES (?,?,?,?,?,?,?,?,?,1)`)
    .bind(
      slugify(input.firstName ?? "", input.lastName ?? ""),
      input.firstName ?? "",
      input.lastName ?? "",
      input.phone ?? "",
      input.email ?? "",
      input.specialty ?? "",
      JSON.stringify(input.instruments ?? []),
      input.biography ?? "",
      input.notes ?? "",
    )
    .run();

  if (typeof inserted.meta.last_row_id !== "number") throw new Error("Failed to create instructor");
  return inserted.meta.last_row_id;
}

const PATCHABLE_COLUMNS: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  phone: "phone",
  email: "email",
  specialty: "specialty",
  biography: "biography",
  notes: "notes",
};

export async function updateInstructor(db: D1Database, id: number, patch: InstructorInput): Promise<boolean> {
  const setClauses: string[] = [];
  const bind: unknown[] = [];

  for (const key of Object.keys(PATCHABLE_COLUMNS)) {
    const value = patch[key as keyof InstructorInput];
    if (value !== undefined) {
      setClauses.push(`${PATCHABLE_COLUMNS[key]} = ?`);
      bind.push(value);
    }
  }

  if (patch.instruments !== undefined) {
    setClauses.push("instruments = ?");
    bind.push(JSON.stringify(patch.instruments));
  }

  if (patch.isActive !== undefined) {
    setClauses.push("is_active = ?");
    bind.push(patch.isActive ? 1 : 0);
  }

  if (!setClauses.length) return true;

  const result = await db
    .prepare(`UPDATE instructors SET ${setClauses.join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...bind, id)
    .run();

  return result.success;
}
