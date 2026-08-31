/*
====================================================
File: src/server/classes.ts

Purpose:
Classes (Section 9) + Class Students (Section 10) of
SCHOOL-MANAGEMENT-IMPLEMENTATION.md.

Course = what is taught (the existing static src/data/courses.js
catalog + course_overrides, via src/server/courses.ts -- reused
here, not duplicated). Class = who, with which instructor, when and
where (Section 9's own distinction). classes.course_id reuses the
same id-space registrations.instrument_id has always used; there is
no separate "courses" D1 table to point a real FK at (course_overrides
only holds rows for courses an admin has edited, not all of them), so
course_id is a plain integer the same way instructor_id/instrument_id
already are on registrations -- see migrations/0021 for the full
rationale.

This is a forward-looking operational layer: classes/class_students
start empty and are populated by admin action from here on, not
backfilled from registrations (see migration 0021 header for why).
====================================================
*/

import { getCourse } from "./courses";

export interface ClassesEnv {
  DB: D1Database;
}

export const CLASS_TYPES = ["individual", "group", "workshop", "online"] as const;
export type ClassType = (typeof CLASS_TYPES)[number];

export const CLASS_STATUSES = ["active", "completed", "cancelled"] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];

export const ENROLLMENT_STATUSES = ["active", "completed", "withdrawn"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

function isValidClassType(value: unknown): value is ClassType {
  return typeof value === "string" && (CLASS_TYPES as readonly string[]).includes(value);
}

export function isValidClassStatus(value: unknown): value is ClassStatus {
  return typeof value === "string" && (CLASS_STATUSES as readonly string[]).includes(value);
}

function isValidEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return typeof value === "string" && (ENROLLMENT_STATUSES as readonly string[]).includes(value);
}

export interface ClassRecord {
  id: number;
  title: string;
  courseId: number;
  instructorId: number;
  room: string;
  classType: ClassType;
  capacity: number;
  level: string;
  startDate: string | null;
  endDate: string | null;
  status: ClassStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ClassRow {
  id: number;
  title: string;
  course_id: number;
  instructor_id: number;
  room: string;
  class_type: string;
  capacity: number;
  level: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function mapClassRow(row: ClassRow): ClassRecord {
  return {
    id: row.id,
    title: row.title,
    courseId: row.course_id,
    instructorId: row.instructor_id,
    room: row.room,
    classType: isValidClassType(row.class_type) ? row.class_type : "individual",
    capacity: row.capacity,
    level: row.level,
    startDate: row.start_date,
    endDate: row.end_date,
    status: isValidClassStatus(row.status) ? row.status : "active",
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const CLASS_COLUMNS =
  "id, title, course_id, instructor_id, room, class_type, capacity, level, start_date, end_date, status, notes, created_at, updated_at";

// ------------------------------------------------------------------
// List
// ------------------------------------------------------------------

export interface ClassListParams {
  search?: string | null;
  status?: string | null;
  instructorId?: number | null;
  page?: number | null;
  pageSize?: number | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Pure (no DB) so it can be unit tested on its own -- see classes.test.ts. */
export function normalizeClassListParams(params: ClassListParams) {
  const search = (params.search ?? "").trim();
  const status = isValidClassStatus(params.status) ? params.status : null;
  const instructorId = Number.isInteger(params.instructorId) && (params.instructorId as number) > 0 ? (params.instructorId as number) : null;

  const rawPage = Number.isFinite(params.page) ? Math.floor(params.page as number) : 1;
  const page = Math.max(1, rawPage);

  const rawPageSize = Number.isFinite(params.pageSize) ? Math.floor(params.pageSize as number) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));

  return { search, status, instructorId, page, pageSize, offset: (page - 1) * pageSize };
}

export interface ClassListItem extends ClassRecord {
  instructorName: string;
  courseTitle: string;
  enrolledCount: number;
}

export interface ClassListResult {
  classes: ClassListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listClasses(db: D1Database, rawParams: ClassListParams): Promise<ClassListResult> {
  const { search, status, instructorId, page, pageSize, offset } = normalizeClassListParams(rawParams);

  const where: string[] = [];
  const bind: unknown[] = [];

  if (status) {
    where.push("classes.status = ?");
    bind.push(status);
  }
  if (instructorId) {
    where.push("classes.instructor_id = ?");
    bind.push(instructorId);
  }
  if (search) {
    where.push("(classes.title LIKE ? OR classes.room LIKE ?)");
    bind.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await db
    .prepare(`SELECT COUNT(*) as count FROM classes ${whereSql}`)
    .bind(...bind)
    .first<{ count: number }>();

  const rows = await db
    .prepare(
      `SELECT ${CLASS_COLUMNS.split(", ")
        .map((c) => `classes.${c}`)
        .join(", ")},
        instructors.first_name as instructor_first_name, instructors.last_name as instructor_last_name,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = classes.id AND cs.status = 'active') as enrolled_count
       FROM classes
       JOIN instructors ON instructors.id = classes.instructor_id
       ${whereSql}
       ORDER BY classes.status ASC, classes.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...bind, pageSize, offset)
    .all<ClassRow & { instructor_first_name: string; instructor_last_name: string; enrolled_count: number }>();

  const classesWithCourse = await Promise.all(
    rows.results.map(async (row) => {
      const course = await getCourse(db, row.course_id);
      return {
        ...mapClassRow(row),
        instructorName: `${row.instructor_first_name} ${row.instructor_last_name}`.trim(),
        courseTitle: (course?.title as string) ?? "-",
        enrolledCount: row.enrolled_count
      };
    })
  );

  return { classes: classesWithCourse, total: totalRow?.count ?? 0, page, pageSize };
}

// ------------------------------------------------------------------
// Full profile: class + enrolled students
// ------------------------------------------------------------------

export interface ClassEnrolledStudent {
  studentId: number;
  firstName: string;
  lastName: string;
  nationalCode: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
}

export interface ClassProfile {
  class: ClassRecord;
  instructorName: string;
  courseTitle: string;
  students: ClassEnrolledStudent[];
}

export async function getClassProfile(db: D1Database, id: number): Promise<ClassProfile | null> {
  const row = await db
    .prepare(
      `SELECT ${CLASS_COLUMNS.split(", ")
        .map((c) => `classes.${c}`)
        .join(", ")},
        instructors.first_name as instructor_first_name, instructors.last_name as instructor_last_name
       FROM classes JOIN instructors ON instructors.id = classes.instructor_id
       WHERE classes.id = ?`
    )
    .bind(id)
    .first<ClassRow & { instructor_first_name: string; instructor_last_name: string }>();

  if (!row) return null;

  const [course, studentsResult] = await Promise.all([
    getCourse(db, row.course_id),
    db
      .prepare(
        `SELECT s.id as student_id, s.first_name, s.last_name, s.national_code, cs.enrollment_date, cs.status
         FROM class_students cs JOIN students s ON s.id = cs.student_id
         WHERE cs.class_id = ?
         ORDER BY cs.status ASC, cs.enrollment_date DESC`
      )
      .bind(id)
      .all<{ student_id: number; first_name: string; last_name: string; national_code: string; enrollment_date: string; status: string }>()
  ]);

  return {
    class: mapClassRow(row),
    instructorName: `${row.instructor_first_name} ${row.instructor_last_name}`.trim(),
    courseTitle: (course?.title as string) ?? "-",
    students: studentsResult.results.map((s) => ({
      studentId: s.student_id,
      firstName: s.first_name,
      lastName: s.last_name,
      nationalCode: s.national_code,
      enrollmentDate: s.enrollment_date,
      status: isValidEnrollmentStatus(s.status) ? s.status : "active"
    }))
  };
}

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

export interface ClassInput {
  title?: string;
  courseId?: number;
  instructorId?: number;
  room?: string;
  classType?: string;
  capacity?: number;
  level?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  notes?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Pure validation, independent of the DB call -- see classes.test.ts. */
export function validateClassInput(input: ClassInput, { isCreate = false }: { isCreate?: boolean } = {}): ValidationResult {
  const errors: string[] = [];

  if (isCreate && !input.title?.trim()) errors.push("عنوان کلاس الزامی است.");
  if (isCreate && !Number.isInteger(input.courseId)) errors.push("انتخاب دوره الزامی است.");
  if (isCreate && !Number.isInteger(input.instructorId)) errors.push("انتخاب مدرس الزامی است.");

  if (input.classType !== undefined && !isValidClassType(input.classType)) errors.push("نوع کلاس معتبر نیست.");
  if (input.status !== undefined && !isValidClassStatus(input.status)) errors.push("وضعیت کلاس معتبر نیست.");
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1)) {
    errors.push("ظرفیت کلاس باید عددی و حداقل ۱ باشد.");
  }

  return { valid: errors.length === 0, errors };
}

// ------------------------------------------------------------------
// Create / Update
// ------------------------------------------------------------------

export async function createClass(db: D1Database, input: ClassInput): Promise<number> {
  const instructor = await db.prepare("SELECT id FROM instructors WHERE id = ?").bind(input.instructorId).first<{ id: number }>();
  if (!instructor) throw new Error("مدرس انتخاب‌شده معتبر نیست.");

  const course = await getCourse(db, input.courseId as number);
  if (!course) throw new Error("دوره‌ی انتخاب‌شده معتبر نیست.");

  const inserted = await db
    .prepare(
      `INSERT INTO classes (title, course_id, instructor_id, room, class_type, capacity, level, start_date, end_date, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      input.title ?? "",
      input.courseId,
      input.instructorId,
      input.room ?? "",
      isValidClassType(input.classType) ? input.classType : "individual",
      input.capacity ?? 1,
      input.level ?? "",
      input.startDate ?? null,
      input.endDate ?? null,
      input.notes ?? ""
    )
    .run();

  if (typeof inserted.meta.last_row_id !== "number") throw new Error("Failed to create class");
  return inserted.meta.last_row_id;
}

const PATCHABLE_COLUMNS: Partial<Record<keyof ClassInput, string>> = {
  title: "title",
  room: "room",
  classType: "class_type",
  capacity: "capacity",
  level: "level",
  startDate: "start_date",
  endDate: "end_date",
  status: "status",
  notes: "notes"
};

export async function updateClass(db: D1Database, id: number, patch: ClassInput): Promise<boolean> {
  const setClauses: string[] = [];
  const bind: unknown[] = [];

  for (const [key, column] of Object.entries(PATCHABLE_COLUMNS) as [keyof ClassInput, string][]) {
    const value = patch[key];
    if (value !== undefined) {
      setClauses.push(`${column} = ?`);
      bind.push(value);
    }
  }

  if (setClauses.length === 0) return true;

  const result = await db
    .prepare(`UPDATE classes SET ${setClauses.join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...bind, id)
    .run();

  return result.success;
}

// ------------------------------------------------------------------
// Enrollment (Section 10)
// ------------------------------------------------------------------

export interface EnrollResult {
  ok: boolean;
  error?: string;
}

export async function enrollStudent(db: D1Database, classId: number, studentId: number): Promise<EnrollResult> {
  const [classRow, student, activeCount, existingActive] = await Promise.all([
    db.prepare("SELECT id, capacity FROM classes WHERE id = ?").bind(classId).first<{ id: number; capacity: number }>(),
    db.prepare("SELECT id FROM students WHERE id = ?").bind(studentId).first<{ id: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM class_students WHERE class_id = ? AND status = 'active'").bind(classId).first<{ count: number }>(),
    db
      .prepare("SELECT id FROM class_students WHERE class_id = ? AND student_id = ? AND status = 'active'")
      .bind(classId, studentId)
      .first<{ id: number }>()
  ]);

  if (!classRow) return { ok: false, error: "کلاس یافت نشد." };
  if (!student) return { ok: false, error: "هنرجو یافت نشد." };
  if (existingActive) return { ok: false, error: "این هنرجو از قبل در این کلاس ثبت‌نام فعال دارد." };
  if ((activeCount?.count ?? 0) >= classRow.capacity) return { ok: false, error: "ظرفیت این کلاس تکمیل شده است." };

  try {
    await db.prepare("INSERT INTO class_students (class_id, student_id) VALUES (?, ?)").bind(classId, studentId).run();
    return { ok: true };
  } catch {
    // Partial unique index caught a race between the check above and this insert.
    return { ok: false, error: "این هنرجو از قبل در این کلاس ثبت‌نام فعال دارد." };
  }
}

export async function updateEnrollmentStatus(db: D1Database, classId: number, studentId: number, status: EnrollmentStatus): Promise<boolean> {
  const result = await db
    .prepare("UPDATE class_students SET status = ? WHERE class_id = ? AND student_id = ? AND status = 'active'")
    .bind(status, classId, studentId)
    .run();
  return result.success;
}
