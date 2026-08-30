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

const COLUMNS = "id, slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active, created_at, updated_at";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parseInstruments(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(function (item) { return typeof item === "string"; }) as string[];
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function (item) { return typeof item === "string"; }) as string[];
  } catch (_) {
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
    updatedAt: row.updated_at || ""
  };
}

function mapStaticInstructor(item: any): InstructorRecord {
  var name = typeof item.name === "string" ? item.name.trim() : "";
  var parts = name ? name.split(/\s+/) : [];
  var identity = item.identity || {};
  var content = item.content || {};
  var relations = item.relations || {};

  return {
    id: Number(item.id),
    slug: item.slug || "",
    firstName: identity.firstName || parts[0] || "",
    lastName: identity.lastName || parts.slice(1).join(" "),
    phone: item.phone || "",
    email: item.email || "",
    specialty: item.position || content.excerpt || "",
    instruments: Array.isArray(relations.courses) ? relations.courses : [],
    biography: content.biography || "",
    notes: "",
    isActive: item.active !== false,
    createdAt: "",
    updatedAt: ""
  };
}

export function normalizeInstructorListParams(params: InstructorListParams): NormalizedInstructorListParams {
  var search = (params.search || "").trim();
  var isActive: boolean | null = null;
  if (params.status === "active") isActive = true;
  if (params.status === "inactive") isActive = false;

  var pageValue = Number(params.page);
  var sizeValue = Number(params.pageSize);
  var page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1;
  var pageSize = Number.isFinite(sizeValue) ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(sizeValue))) : DEFAULT_PAGE_SIZE;

  return {
    search: search,
    isActive: isActive,
    page: page,
    pageSize: pageSize,
    offset: (page - 1) * pageSize
  };
}

export async function listInstructors(db: D1Database, params: InstructorListParams): Promise<InstructorListResult> {
  var normalized = normalizeInstructorListParams(params);
  var where: string[] = [];
  var bindings: any[] = [];

  if (normalized.isActive !== null) {
    where.push("is_active = ?");
    bindings.push(normalized.isActive ? 1 : 0);
  }

  if (normalized.search) {
    where.push("((first_name || ' ' || last_name) LIKE ? OR specialty LIKE ? OR phone LIKE ?)");
    var term = "%" + normalized.search + "%";
    bindings.push(term, term, term);
  }

  var whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  try {
    var totalResult: any = await db.prepare("SELECT COUNT(*) AS count FROM instructors " + whereSql).bind.apply(null, bindings).first();
    var sql = "SELECT " + COLUMNS + ", (SELECT COUNT(DISTINCT r.student_national_code) FROM registrations r WHERE r.instructor_id = instructors.id AND r.student_national_code IS NOT NULL AND r.student_national_code != '') AS student_count FROM instructors " + whereSql + " ORDER BY is_active DESC, first_name, last_name LIMIT ? OFFSET ?";
    var allBindings = bindings.concat([normalized.pageSize, normalized.offset]);
    var rowsResult: any = await db.prepare(sql).bind.apply(null, allBindings).all();

    if (rowsResult && Array.isArray(rowsResult.results) && rowsResult.results.length > 0) {
      return {
        instructors: rowsResult.results.map(function (row: any) {
          return Object.assign({}, mapDbInstructor(row), { studentCount: Number(row.student_count) || 0 });
        }),
        total: Number(totalResult && totalResult.count) || 0,
        page: normalized.page,
        pageSize: normalized.pageSize
      };
    }
  } catch (error) {
    console.error("[admin/instructors] list query failed", error);
  }

  var filtered = staticInstructors.filter(function (item: any) {
    var identity = item.identity || {};
    var name = item.name || ((identity.firstName || "") + " " + (identity.lastName || "")).trim();
    var position = String(item.position || "");
    var matchesSearch = !normalized.search || name.indexOf(normalized.search) !== -1 || position.indexOf(normalized.search) !== -1;
    var matchesStatus = normalized.isActive === null || item.active === normalized.isActive;
    return matchesSearch && matchesStatus;
  });

  return {
    instructors: filtered.slice(normalized.offset, normalized.offset + normalized.pageSize).map(function (item: any) {
      return Object.assign({}, mapStaticInstructor(item), { studentCount: 0 });
    }),
    total: filtered.length,
    page: normalized.page,
    pageSize: normalized.pageSize
  };
}

export async function getInstructorProfile(db: D1Database, id: number): Promise<InstructorProfile | null> {
  var instructor: InstructorRecord | null = null;

  try {
    var row: any = await db.prepare("SELECT " + COLUMNS + " FROM instructors WHERE id = ?").bind(id).first();
    if (row) instructor = mapDbInstructor(row);
  } catch (error) {
    console.error("[admin/instructors] profile instructor query failed", error);
  }

  if (!instructor) {
    var item = staticInstructors.find(function (entry: any) { return Number(entry.id) === Number(id); });
    if (item) instructor = mapStaticInstructor(item);
  }

  if (!instructor) return null;

  var students: InstructorStudentSummary[] = [];

  try {
    var studentSql = "SELECT s.id AS student_id, s.first_name, s.last_name, s.national_code, s.status AS student_status, r.instrument_title AS course, COUNT(*) AS term_count, MIN(r.created_at) AS start_date, MAX(r.created_at) AS last_activity FROM registrations r JOIN students s ON s.id = r.student_id WHERE r.instructor_id = ? GROUP BY s.id, r.instrument_title ORDER BY last_activity DESC";
    var result: any = await db.prepare(studentSql).bind(id).all();

    if (result && Array.isArray(result.results)) {
      result.results.forEach(function (student: any) {
        students.push({
          studentId: Number(student.student_id),
          firstName: student.first_name || "",
          lastName: student.last_name || "",
          nationalCode: student.national_code || "",
          studentStatus: student.student_status || "",
          course: student.course || "",
          termCount: Number(student.term_count) || 0,
          startDate: student.start_date || "",
          lastActivity: student.last_activity || ""
        });
      });
    }
  } catch (error) {
    console.error("[admin/instructors] profile student query failed", error);
  }

  return { instructor: instructor, students: students };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInstructorInput(input: InstructorInput, options: { isCreate?: boolean } = {}): ValidationResult {
  var errors: string[] = [];
  if (options.isCreate && !input.firstName?.trim()) errors.push("نام مدرس الزامی است.");
  if (options.isCreate && !input.lastName?.trim()) errors.push("نام خانوادگی مدرس الزامی است.");
  if (input.email !== undefined && input.email !== "" && !EMAIL_RE.test(input.email)) errors.push("ایمیل معتبر نیست.");
  if (input.instruments !== undefined && !Array.isArray(input.instruments)) errors.push("فهرست سازهای آموزشی معتبر نیست.");
  return { valid: errors.length === 0, errors: errors };
}

function slugify(firstName: string, lastName: string): string {
  var base = (firstName + "-" + lastName).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06FF-]/g, "");
  return base || ("instructor-" + Date.now());
}

export async function createInstructor(db: D1Database, input: InstructorInput): Promise<number> {
  var result: any = await db.prepare("INSERT INTO instructors (slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active) VALUES (?,?,?,?,?,?,?,?,?,1)").bind(
    slugify(input.firstName || "", input.lastName || ""),
    input.firstName || "",
    input.lastName || "",
    input.phone || "",
    input.email || "",
    input.specialty || "",
    JSON.stringify(input.instruments || []),
    input.biography || "",
    input.notes || ""
  ).run();

  if (!result || !result.meta || typeof result.meta.last_row_id !== "number") throw new Error("Failed to create instructor");
  return result.meta.last_row_id;
}

const PATCHABLE_COLUMNS: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  phone: "phone",
  email: "email",
  specialty: "specialty",
  biography: "biography",
  notes: "notes"
};

export async function updateInstructor(db: D1Database, id: number, patch: InstructorInput): Promise<boolean> {
  var setClauses: string[] = [];
  var bindings: any[] = [];

  Object.keys(PATCHABLE_COLUMNS).forEach(function (key) {
    var value = patch[key as keyof InstructorInput];
    if (value !== undefined) {
      setClauses.push(PATCHABLE_COLUMNS[key] + " = ?");
      bindings.push(value);
    }
  });

  if (patch.instruments !== undefined) {
    setClauses.push("instruments = ?");
    bindings.push(JSON.stringify(patch.instruments));
  }

  if (patch.isActive !== undefined) {
    setClauses.push("is_active = ?");
    bindings.push(patch.isActive ? 1 : 0);
  }

  if (setClauses.length === 0) return true;

  var sql = "UPDATE instructors SET " + setClauses.join(", ") + ", updated_at = datetime('now') WHERE id = ?";
  bindings.push(id);
  var result: any = await db.prepare(sql).bind.apply(null, bindings).run();
  return !!(result && result.success);
}
