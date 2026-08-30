import { instructors as staticInstructors } from "../data/instructors.js";

export interface InstructorsEnv { DB: D1Database; }

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

export interface InstructorListItem extends InstructorRecord {
  studentCount: number;
}

export interface InstructorListResult {
  instructors: InstructorListItem[];
  total: number;
  page: number;
  pageSize: number;
}

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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const COLUMNS = "id, slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active, created_at, updated_at";

function parseInstruments(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch (error) {
    return [];
  }
}

function mapDbInstructor(row: any): InstructorRecord {
  return {
    id: Number(row.id),
    slug: row.slug || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    phone: row.phone || "",
    email: row.email || "",
    specialty: row.specialty || "",
    instruments: parseInstruments(row.instruments),
    biography: row.biography || "",
    notes: row.notes || "",
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function mapStaticInstructor(item: any): InstructorRecord {
  const fullName = typeof item.name === "string" ? item.name.trim() : "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    id: Number(item.id),
    slug: item.slug || "",
    firstName: item.identity?.firstName || parts[0] || "",
    lastName: item.identity?.lastName || parts.slice(1).join(" "),
    phone: item.phone || "",
    email: item.email || "",
    specialty: item.position || item.content?.excerpt || "",
    instruments: Array.isArray(item.relations?.courses) ? item.relations.courses : [],
    biography: item.content?.biography || "",
    notes: "",
    isActive: item.active !== false,
    createdAt: "",
    updatedAt: "",
  };
}

export function normalizeInstructorListParams(params: InstructorListParams): NormalizedInstructorListParams {
  const search = (params.search || "").trim();
  let isActive: boolean | null = null;
  if (params.status === "active") isActive = true;
  if (params.status === "inactive") isActive = false;

  const pageValue = Number(params.page);
  const sizeValue = Number(params.pageSize);
  const page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1;
  const pageSize = Number.isFinite(sizeValue)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(sizeValue)))
    : DEFAULT_PAGE_SIZE;

  return { search, isActive, page, pageSize, offset: (page - 1) * pageSize };
}

export async function listInstructors(db: D1Database, params: InstructorListParams): Promise<InstructorListResult> {
  const normalized = normalizeInstructorListParams(params);
  const where: string[] = [];
  const bindings: any[] = [];

  if (normalized.isActive !== null) {
    where.push("is_active = ?");
    bindings.push(normalized.isActive ? 1 : 0);
  }

  if (normalized.search) {
    where.push("((first_name || ' ' || last_name) LIKE ? OR specialty LIKE ? OR phone LIKE ?)");
    const term = `%${normalized.search}%`;
    bindings.push(term, term, term);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const totalResult: any = await db.prepare(`SELECT COUNT(*) AS count FROM instructors ${whereSql}`).bind(...bindings).first();
    const rowsResult: any = await db.prepare(`SELECT ${COLUMNS}, (SELECT COUNT(DISTINCT r.student_national_code) FROM registrations r WHERE r.instructor_id = instructors.id AND r.student_national_code IS NOT NULL AND r.student_national_code != '') AS student_count FROM instructors ${whereSql} ORDER BY is_active DESC, first_name, last_name LIMIT ? OFFSET ?`).bind(...bindings, normalized.pageSize, normalized.offset).all();

    if (rowsResult && Array.isArray(rowsResult.results) && rowsResult.results.length) {
      return {
        instructors: rowsResult.results.map((row: any) => ({ ...mapDbInstructor(row), studentCount: Number(row.student_count) || 0 })),
        total: Number(totalResult?.count) || 0,
        page: normalized.page,
        pageSize: normalized.pageSize,
      };
    }
  } catch (error) {
    console.error("[admin/instructors] list query failed", error);
  }

  const filtered = staticInstructors.filter((item: any) => {
    const name = item.name || `${item.identity?.firstName || ""} ${item.identity?.lastName || ""}`.trim();
    const matchesSearch = !normalized.search || name.includes(normalized.search) || String(item.position || "").includes(normalized.search);
    const matchesStatus = normalized.isActive === null || item.active === normalized.isActive;
    return matchesSearch && matchesStatus;
  });

  return {
    instructors: filtered.slice(normalized.offset, normalized.offset + normalized.pageSize).map((item: any) => ({ ...mapStaticInstructor(item), studentCount: 0 })),
    total: filtered.length,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export async function getInstructorProfile(db: D1Database, id: number): Promise<InstructorProfile | null> {
  let instructor: InstructorRecord | null = null;

  try {
    const row: any = await db.prepare(`SELECT ${COLUMNS} FROM instructors WHERE id = ?`).bind(id).first();
    if (row) instructor = mapDbInstructor(row);
  } catch (error) {
    console.error("[admin/instructors] profile instructor query failed", error);
  }

  if (!instructor) {
    const item = staticInstructors.find((entry: any) => Number(entry.id) === Number(id));
    if (item) instructor = mapStaticInstructor(item);
  }

  if (!instructor) return null;

  const students: InstructorStudentSummary[] = [];

  try {
    const result: any = await db.prepare(`SELECT s.id AS student_id, s.first_name, s.last_name, s.national_code, s.status AS student_status, r.instrument_title AS course, COUNT(*) AS term_count, MIN(r.created_at) AS start_date, MAX(r.created_at) AS last_activity FROM registrations r JOIN students s ON s.id = r.student_id WHERE r.instructor_id = ? GROUP BY s.id, r.instrument_title ORDER BY last_activity DESC`).bind(id).all();

    if (result && Array.isArray(result.results)) {
      for (const row of result.results) {
        students.push({
          studentId: Number(row.student_id),
          firstName: row.first_name || "",
          lastName: row.last_name || "",
          nationalCode: row.national_code || "",
          studentStatus: row.student_status || "",
          course: row.course || "",
          termCount: Number(row.term_count) || 0,
          startDate: row.start_date || "",
          lastActivity: row.last_activity || "",
        });
      }
    }
  } catch (error) {
    console.error("[admin/instructors] profile student query failed", error);
  }

  return { instructor, students };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInstructorInput(input: InstructorInput, options: { isCreate?: boolean } = {}): ValidationResult {
  const errors: string[] = [];
  if (options.isCreate && !input.firstName?.trim()) errors.push("نام مدرس الزامی است.");
  if (options.isCreate && !input.lastName?.trim()) errors.push("نام خانوادگی مدرس الزامی است.");
  if (input.email !== undefined && input.email !== "" && !EMAIL_RE.test(input.email)) errors.push("ایمیل معتبر نیست.");
  if (input.instruments !== undefined && !Array.isArray(input.instruments)) errors.push("فهرست سازهای آموزشی معتبر نیست.");
  return { valid: errors.length === 0, errors };
}

function slugify(firstName: string, lastName: string): string {
  const base = `${firstName}-${lastName}`.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06FF-]/g, "");
  return base || `instructor-${Date.now()}`;
}

export async function createInstructor(db: D1Database, input: InstructorInput): Promise<number> {
  const result: any = await db.prepare(`INSERT INTO instructors (slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active) VALUES (?,?,?,?,?,?,?,?,?,1)`).bind(
    slugify(input.firstName || "", input.lastName || ""),
    input.firstName || "",
    input.lastName || "",
    input.phone || "",
    input.email || "",
    input.specialty || "",
    JSON.stringify(input.instruments || []),
    input.biography || "",
    input.notes || "",
  ).run();
  if (typeof result?.meta?.last_row_id !== "number") throw new Error("Failed to create instructor");
  return result.meta.last_row_id;
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
  const bindings: any[] = [];

  for (const key of Object.keys(PATCHABLE_COLUMNS)) {
    const value = patch[key as keyof InstructorInput];
    if (value !== undefined) {
      setClauses.push(`${PATCHABLE_COLUMNS[key]} = ?`);
      bindings.push(value);
    }
  }

  if (patch.instruments !== undefined) {
    setClauses.push("instruments = ?");
    bindings.push(JSON.stringify(patch.instruments));
  }

  if (patch.isActive !== undefined) {
    setClauses.push("is_active = ?");
    bindings.push(patch.isActive ? 1 : 0);
  }

  if (!setClauses.length) return true;

  const result: any = await db.prepare(`UPDATE instructors SET ${setClauses.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...bindings, id).run();
  return result?.success === true;
}
