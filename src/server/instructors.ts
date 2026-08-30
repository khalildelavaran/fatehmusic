import { instructors as staticInstructors } from "../data/instructors.js";

export interface InstructorsEnv { DB: D1Database; }
export interface InstructorRecord { id:number; slug:string; firstName:string; lastName:string; phone:string; email:string; specialty:string; instruments:string[]; biography:string; notes:string; isActive:boolean; createdAt:string; updatedAt:string; }
export interface InstructorStudentSummary { studentId:number; firstName:string; lastName:string; nationalCode:string; studentStatus:string; course:string; termCount:number; startDate:string; lastActivity:string; }
export interface InstructorProfile { instructor:InstructorRecord; students:InstructorStudentSummary[]; }
export interface InstructorListParams { search?:string|null; status?:string|null; page?:number|null; pageSize?:number|null; }
export interface NormalizedInstructorListParams { search:string; isActive:boolean|null; page:number; pageSize:number; offset:number; }
export interface InstructorListItem extends InstructorRecord { studentCount:number; }
export interface InstructorListResult { instructors:InstructorListItem[]; total:number; page:number; pageSize:number; }
export interface InstructorInput { firstName?:string; lastName?:string; phone?:string; email?:string; specialty?:string; instruments?:string[]; biography?:string; notes?:string; isActive?:boolean; }
export interface ValidationResult { valid:boolean; errors:string[]; }

const COLUMNS = "id, slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active, created_at, updated_at";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parseInstruments(value:unknown):string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed:unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item:unknown): item is string => typeof item === "string") : [];
  } catch { return []; }
}

function mapDbInstructor(row:any):InstructorRecord {
  return { id:Number(row.id), slug:String(row.slug || ""), firstName:String(row.first_name || ""), lastName:String(row.last_name || ""), phone:String(row.phone || ""), email:String(row.email || ""), specialty:String(row.specialty || ""), instruments:parseInstruments(row.instruments), biography:String(row.biography || ""), notes:String(row.notes || ""), isActive:Number(row.is_active) === 1, createdAt:String(row.created_at || ""), updatedAt:String(row.updated_at || "") };
}

function mapStaticInstructor(item:any):InstructorRecord {
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const parts = name ? name.split(/\s+/) : [];
  const identity = item.identity || {};
  const content = item.content || {};
  const relations = item.relations || {};
  return { id:Number(item.id), slug:String(item.slug || ""), firstName:String(identity.firstName || parts[0] || ""), lastName:String(identity.lastName || parts.slice(1).join(" ")), phone:String(item.phone || ""), email:String(item.email || ""), specialty:String(item.position || content.excerpt || ""), instruments:Array.isArray(relations.courses) ? relations.courses : [], biography:String(content.biography || ""), notes:"", isActive:item.active !== false, createdAt:"", updatedAt:"" };
}

export function normalizeInstructorListParams(params:InstructorListParams):NormalizedInstructorListParams {
  const search = String(params.search || "").trim();
  let isActive:boolean|null = null;
  if (params.status === "active") isActive = true;
  else if (params.status === "inactive") isActive = false;
  const pageNumber = Number(params.page);
  const sizeNumber = Number(params.pageSize);
  const page = Number.isFinite(pageNumber) ? Math.max(1, Math.floor(pageNumber)) : 1;
  const pageSize = Number.isFinite(sizeNumber) ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(sizeNumber))) : DEFAULT_PAGE_SIZE;
  return { search, isActive, page, pageSize, offset:(page - 1) * pageSize };
}

export async function listInstructors(db:D1Database, params:InstructorListParams):Promise<InstructorListResult> {
  const normalized = normalizeInstructorListParams(params);
  const where:string[] = [];
  const bindings:any[] = [];
  if (normalized.isActive !== null) { where.push("is_active = ?"); bindings.push(normalized.isActive ? 1 : 0); }
  if (normalized.search) { where.push("((first_name || ' ' || last_name) LIKE ? OR specialty LIKE ? OR phone LIKE ?)"); const term = "%" + normalized.search + "%"; bindings.push(term, term, term); }
  const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  try {
    let totalStatement = db.prepare("SELECT COUNT(*) AS count FROM instructors " + whereSql);
    totalStatement = totalStatement.bind(...bindings);
    const totalRow:any = await totalStatement.first();
    const sql = "SELECT " + COLUMNS + ", (SELECT COUNT(DISTINCT r.student_national_code) FROM registrations r WHERE r.instructor_id = instructors.id AND r.student_national_code IS NOT NULL AND r.student_national_code != '') AS student_count FROM instructors " + whereSql + " ORDER BY is_active DESC, first_name, last_name LIMIT ? OFFSET ?";
    const rowBindings = bindings.concat([normalized.pageSize, normalized.offset]);
    let rowStatement = db.prepare(sql);
    rowStatement = rowStatement.bind(...rowBindings);
    const rows:any = await rowStatement.all();
    if (rows && Array.isArray(rows.results)) {
      const instructors:InstructorListItem[] = [];
      for (const row of rows.results) {
        const instructor = mapDbInstructor(row);
        instructors.push({ ...instructor, studentCount:Number(row.student_count) || 0 });
      }
      return { instructors, total:Number(totalRow && totalRow.count) || 0, page:normalized.page, pageSize:normalized.pageSize };
    }
  } catch (error) { console.error("[admin/instructors] list query failed", error); }

  const filtered:any[] = [];
  for (const item of staticInstructors as any[]) {
    const identity = item.identity || {};
    const name = String(item.name || ((identity.firstName || "") + " " + (identity.lastName || "")).trim());
    const position = String(item.position || "");
    const matchesSearch = !normalized.search || name.includes(normalized.search) || position.includes(normalized.search);
    const matchesStatus = normalized.isActive === null || item.active === normalized.isActive;
    if (matchesSearch && matchesStatus) filtered.push(item);
  }
  const pageItems = filtered.slice(normalized.offset, normalized.offset + normalized.pageSize);
  const instructors:InstructorListItem[] = [];
  for (const item of pageItems) {
    const instructor = mapStaticInstructor(item);
    instructors.push({ ...instructor, studentCount:0 });
  }
  return { instructors, total:filtered.length, page:normalized.page, pageSize:normalized.pageSize };
}

export async function getInstructorProfile(db:D1Database, id:number):Promise<InstructorProfile|null> {
  let instructor:InstructorRecord|null = null;
  try {
    let statement = db.prepare("SELECT " + COLUMNS + " FROM instructors WHERE id = ?");
    statement = statement.bind(id);
    const row:any = await statement.first();
    if (row) instructor = mapDbInstructor(row);
  } catch (error) { console.error("[admin/instructors] profile instructor query failed", error); }
  if (!instructor) {
    for (const item of staticInstructors as any[]) {
      if (Number(item.id) === Number(id)) { instructor = mapStaticInstructor(item); break; }
    }
  }
  if (!instructor) return null;
  const students:InstructorStudentSummary[] = [];
  try {
    const sql = "SELECT s.id AS student_id, s.first_name, s.last_name, s.national_code, s.status AS student_status, r.instrument_title AS course, COUNT(*) AS term_count, MIN(r.created_at) AS start_date, MAX(r.created_at) AS last_activity FROM registrations r JOIN students s ON s.id = r.student_id WHERE r.instructor_id = ? GROUP BY s.id, r.instrument_title ORDER BY last_activity DESC";
    let statement = db.prepare(sql);
    statement = statement.bind(id);
    const result:any = await statement.all();
    if (result && Array.isArray(result.results)) {
      for (const student of result.results) {
        students.push({ studentId:Number(student.student_id), firstName:String(student.first_name || ""), lastName:String(student.last_name || ""), nationalCode:String(student.national_code || ""), studentStatus:String(student.student_status || ""), course:String(student.course || ""), termCount:Number(student.term_count) || 0, startDate:String(student.start_date || ""), lastActivity:String(student.last_activity || "") });
      }
    }
  } catch (error) { console.error("[admin/instructors] profile student query failed", error); }
  return { instructor, students };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateInstructorInput(input:InstructorInput, options:{isCreate?:boolean} = {}):ValidationResult {
  const errors:string[] = [];
  const isCreate = options.isCreate === true;
  if (isCreate && !input.firstName?.trim()) errors.push("نام مدرس الزامی است.");
  if (isCreate && !input.lastName?.trim()) errors.push("نام خانوادگی مدرس الزامی است.");
  if (input.email !== undefined && input.email !== "" && !EMAIL_RE.test(input.email)) errors.push("ایمیل معتبر نیست.");
  if (input.instruments !== undefined && !Array.isArray(input.instruments)) errors.push("فهرست سازهای آموزشی معتبر نیست.");
  return { valid:errors.length === 0, errors };
}

function slugify(firstName:string, lastName:string):string {
  const base = (firstName + "-" + lastName).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06FF-]/g, "");
  return base || "instructor-" + Date.now();
}

export async function createInstructor(db:D1Database, input:InstructorInput):Promise<number> {
  const statement = db.prepare("INSERT INTO instructors (slug, first_name, last_name, phone, email, specialty, instruments, biography, notes, is_active) VALUES (?,?,?,?,?,?,?,?,?,1)");
  const result:any = await statement.bind(slugify(input.firstName || "", input.lastName || ""), input.firstName || "", input.lastName || "", input.phone || "", input.email || "", input.specialty || "", JSON.stringify(input.instruments || []), input.biography || "", input.notes || "").run();
  if (!result || !result.meta || typeof result.meta.last_row_id !== "number") throw new Error("Failed to create instructor");
  return result.meta.last_row_id;
}

export async function updateInstructor(db:D1Database, id:number, patch:InstructorInput):Promise<boolean> {
  const columnMap:Record<string,string> = { firstName:"first_name", lastName:"last_name", phone:"phone", email:"email", specialty:"specialty", biography:"biography", notes:"notes" };
  const setClauses:string[] = [];
  const bindings:any[] = [];
  const patchData:any = patch;
  for (const key of Object.keys(columnMap)) {
    if (patchData[key] !== undefined) { setClauses.push(columnMap[key] + " = ?"); bindings.push(patchData[key]); }
  }
  if (patch.instruments !== undefined) { setClauses.push("instruments = ?"); bindings.push(JSON.stringify(patch.instruments)); }
  if (patch.isActive !== undefined) { setClauses.push("is_active = ?"); bindings.push(patch.isActive ? 1 : 0); }
  if (setClauses.length === 0) return true;
  const sql = "UPDATE instructors SET " + setClauses.join(", ") + ", updated_at = datetime('now') WHERE id = ?";
  let statement = db.prepare(sql);
  statement = statement.bind(...bindings, id);
  const result:any = await statement.run();
  return !!(result && result.success);
}
