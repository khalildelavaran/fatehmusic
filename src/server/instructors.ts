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

export interface InstructorValidationOptions {
  isCreate?: boolean;
}

var COLUMNS = "id, slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active, created_at, updated_at";
var DEFAULT_PAGE_SIZE = 20;
var MAX_PAGE_SIZE = 100;

function parseInstruments(value: any): string[] {
  if (typeof value !== "string") {
    return [];
  }
  try {
    var parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    var result: string[] = [];
    for (var i = 0; i < parsed.length; i++) {
      if (typeof parsed[i] === "string") {
        result.push(parsed[i]);
      }
    }
    return result;
  } catch (error) {
    return [];
  }
}

function mapDbInstructor(row: any): InstructorRecord {
  return {
    id: Number(row.id),
    slug: String(row.slug || ""),
    firstName: String(row.first_name || ""),
    lastName: String(row.last_name || ""),
    phone: String(row.phone || ""),
    email: String(row.email || ""),
    specialty: String(row.specialty || ""),
    instruments: parseInstruments(row.instruments),
    biography: String(row.biography || ""),
    notes: String(row.notes || ""),
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || "")
  };
}

function mapStaticInstructor(item: any): InstructorRecord {
  var name = typeof item.name === "string" ? item.name.trim() : "";
  var parts = name ? name.split(/\s+/) : [];
  var identity = item.identity || {};
  var content = item.content || {};
  var relations = item.relations || {};
  var firstName = identity.firstName || (parts.length > 0 ? parts[0] : "");
  var lastName = identity.lastName || parts.slice(1).join(" ");

  return {
    id: Number(item.id),
    slug: String(item.slug || ""),
    firstName: String(firstName),
    lastName: String(lastName),
    phone: String(item.phone || ""),
    email: String(item.email || ""),
    specialty: String(item.position || content.excerpt || ""),
    instruments: Array.isArray(relations.courses) ? relations.courses : [],
    biography: String(content.biography || ""),
    notes: "",
    isActive: item.active !== false,
    createdAt: "",
    updatedAt: ""
  };
}

export function normalizeInstructorListParams(params: InstructorListParams): NormalizedInstructorListParams {
  var search = String(params.search || "").trim();
  var isActive: boolean | null = null;
  var pageNumber = Number(params.page);
  var sizeNumber = Number(params.pageSize);
  var page = 1;
  var pageSize = DEFAULT_PAGE_SIZE;

  if (params.status === "active") {
    isActive = true;
  } else if (params.status === "inactive") {
    isActive = false;
  }

  if (Number.isFinite(pageNumber)) {
    page = Math.max(1, Math.floor(pageNumber));
  }
  if (Number.isFinite(sizeNumber)) {
    pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(sizeNumber)));
  }

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

  var whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  try {
    var totalSql = "SELECT COUNT(*) AS count FROM instructors " + whereSql;
    var totalRow: any = await db.prepare(totalSql).bind.apply(null, bindings).first();
    var sql = "SELECT " + COLUMNS + ", (SELECT COUNT(DISTINCT r.student_national_code) FROM registrations r WHERE r.instructor_id = instructors.id AND r.student_national_code IS NOT NULL AND r.student_national_code != '') AS student_count FROM instructors " + whereSql + " ORDER BY is_active DESC, first_name, last_name LIMIT ? OFFSET ?";
    var queryBindings = bindings.slice();
    queryBindings.push(normalized.pageSize);
    queryBindings.push(normalized.offset);
    var rows: any = await db.prepare(sql).bind.apply(null, queryBindings).all();

    if (rows && Array.isArray(rows.results)) {
      var instructors: InstructorListItem[] = [];
      for (var i = 0; i < rows.results.length; i++) {
        var row = rows.results[i];
        var instructor = mapDbInstructor(row);
        instructors.push({
          id: instructor.id,
          slug: instructor.slug,
          firstName: instructor.firstName,
          lastName: instructor.lastName,
          phone: instructor.phone,
          email: instructor.email,
          specialty: instructor.specialty,
          instruments: instructor.instruments,
          biography: instructor.biography,
          notes: instructor.notes,
          isActive: instructor.isActive,
          createdAt: instructor.createdAt,
          updatedAt: instructor.updatedAt,
          studentCount: Number(row.student_count) || 0
        });
      }
      return {
        instructors: instructors,
        total: Number(totalRow && totalRow.count) || 0,
        page: normalized.page,
        pageSize: normalized.pageSize
      };
    }
  } catch (error) {
    console.error("[admin/instructors] list query failed", error);
  }

  var filtered: any[] = [];
  for (var j = 0; j < staticInstructors.length; j++) {
    var item: any = staticInstructors[j];
    var identity = item.identity || {};
    var fallbackName = String(identity.firstName || "") + " " + String(identity.lastName || "");
    var name = String(item.name || fallbackName).trim();
    var position = String(item.position || "");
    var matchesSearch = !normalized.search || name.indexOf(normalized.search) >= 0 || position.indexOf(normalized.search) >= 0;
    var matchesStatus = normalized.isActive === null || item.active === normalized.isActive;

    if (matchesSearch && matchesStatus) {
      filtered.push(item);
    }
  }

  var pageItems = filtered.slice(normalized.offset, normalized.offset + normalized.pageSize);
  var resultInstructors: InstructorListItem[] = [];
  for (var k = 0; k < pageItems.length; k++) {
    var mapped = mapStaticInstructor(pageItems[k]);
    resultInstructors.push({
      id: mapped.id,
      slug: mapped.slug,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      phone: mapped.phone,
      email: mapped.email,
      specialty: mapped.specialty,
      instruments: mapped.instruments,
      biography: mapped.biography,
      notes: mapped.notes,
      isActive: mapped.isActive,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
      studentCount: 0
    });
  }

  return {
    instructors: resultInstructors,
    total: filtered.length,
    page: normalized.page,
    pageSize: normalized.pageSize
  };
}

export async function getInstructorProfile(db: D1Database, id: number): Promise<InstructorProfile | null> {
  var instructor: InstructorRecord | null = null;

  try {
    var statement = db.prepare("SELECT " + COLUMNS + " FROM instructors WHERE id = ?");
    var row: any = await statement.bind(id).first();
    if (row) {
      instructor = mapDbInstructor(row);
    }
  } catch (error) {
    console.error("[admin/instructors] profile instructor query failed", error);
  }

  if (!instructor) {
    for (var i = 0; i < staticInstructors.length; i++) {
      if (Number(staticInstructors[i].id) === Number(id)) {
        instructor = mapStaticInstructor(staticInstructors[i]);
        break;
      }
    }
  }

  if (!instructor) {
    return null;
  }

  var students: InstructorStudentSummary[] = [];

  try {
    var sql = "SELECT s.id AS student_id, s.first_name, s.last_name, s.national_code, s.status AS student_status, r.instrument_title AS course, COUNT(*) AS term_count, MIN(r.created_at) AS start_date, MAX(r.created_at) AS last_activity FROM registrations r JOIN students s ON s.id = r.student_id WHERE r.instructor_id = ? GROUP BY s.id, r.instrument_title ORDER BY last_activity DESC";
    var result: any = await db.prepare(sql).bind(id).all();
    if (result && Array.isArray(result.results)) {
      for (var j = 0; j < result.results.length; j++) {
        var studentRow = result.results[j];
        students.push({
          studentId: Number(studentRow.student_id),
          firstName: String(studentRow.first_name || ""),
          lastName: String(studentRow.last_name || ""),
          nationalCode: String(studentRow.national_code || ""),
          studentStatus: String(studentRow.student_status || ""),
          course: String(studentRow.course || ""),
          termCount: Number(studentRow.term_count) || 0,
          startDate: String(studentRow.start_date || ""),
          lastActivity: String(studentRow.last_activity || "")
        });
      }
    }
  } catch (error) {
    console.error("[admin/instructors] profile student query failed", error);
  }

  return {
    instructor: instructor,
    students: students
  };
}

export function validateInstructorInput(input: InstructorInput, options: InstructorValidationOptions = {}): ValidationResult {
  var errors: string[] = [];
  var isCreate = options.isCreate === true;
  var firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  var lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";

  if (isCreate && !firstName) {
    errors.push("نام مدرس الزامی است.");
  }
  if (isCreate && !lastName) {
    errors.push("نام خانوادگی مدرس الزامی است.");
  }
  if (input.email !== undefined && input.email !== "") {
    var email = String(input.email);
    var at = email.indexOf("@");
    var dot = email.lastIndexOf(".");
    if (at <= 0 || dot <= at + 1 || dot >= email.length - 1) {
      errors.push("ایمیل معتبر نیست.");
    }
  }
  if (input.instruments !== undefined && !Array.isArray(input.instruments)) {
    errors.push("فهرست سازهای آموزشی معتبر نیست.");
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function slugify(firstName: string, lastName: string): string {
  var raw = (firstName + "-" + lastName).trim().toLowerCase();
  var result = "";
  for (var i = 0; i < raw.length; i++) {
    var character = raw.charAt(i);
    var code = character.charCodeAt(0);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57) || character === "-" || (code >= 0x0600 && code <= 0x06ff)) {
      result += character;
    } else if (/\s/.test(character)) {
      result += "-";
    }
  }
  return result || "instructor-" + Date.now();
}

export async function createInstructor(db: D1Database, input: InstructorInput): Promise<number> {
  var values = [
    slugify(input.firstName || "", input.lastName || ""),
    input.firstName || "",
    input.lastName || "",
    input.phone || "",
    input.email || "",
    input.specialty || "",
    JSON.stringify(input.instruments || []),
    input.biography || "",
    input.notes || ""
  ];

  var sql = "INSERT INTO instructors (slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)";
  var result: any = await db.prepare(sql).bind.apply(null, values).run();

  if (!result || !result.meta || typeof result.meta.last_row_id !== "number") {
    throw new Error("Failed to create instructor");
  }
  return result.meta.last_row_id;
}

export async function updateInstructor(db: D1Database, id: number, patch: InstructorInput): Promise<boolean> {
  var columnMap: { [key: string]: string } = {
    firstName: "first_name",
    lastName: "last_name",
    phone: "phone",
    email: "email",
    specialty: "specialty",
    biography: "biography",
    notes: "notes"
  };
  var setClauses: string[] = [];
  var bindings: any[] = [];
  var keys = Object.keys(columnMap);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = (patch as any)[key];
    if (value !== undefined) {
      setClauses.push(columnMap[key] + " = ?");
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
  if (setClauses.length === 0) {
    return true;
  }

  var sql = "UPDATE instructors SET " + setClauses.join(", ") + ", updated_at = datetime('now') WHERE id = ?";
  bindings.push(id);
  var result: any = await db.prepare(sql).bind.apply(null, bindings).run();
  return Boolean(result && result.success);
}
