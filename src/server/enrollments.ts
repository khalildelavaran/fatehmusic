/*
 * Operational enrollment domain.
 *
 * Enrollment is the student's membership in a Class.
 * EnrollmentTerm is the student's billing/session cycle and starts on the
 * first concrete ClassSession assigned to that enrollment, not on the
 * registration record's historical term number.
 */

export interface EnrollmentEnv { DB: D1Database; }

export const ENROLLMENT_STATUSES = ["active", "completed", "withdrawn"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const TERM_STATUSES = ["active", "completed", "cancelled"] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

export const BILLING_TYPES = ["session_based", "monthly"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const ATTENDANCE_STATUSES = ["present", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_MODES = ["in_person", "online"] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

export interface EnrollmentRecord {
  id: number;
  classId: number;
  studentId: number;
  enrolledAt: string;
  status: EnrollmentStatus;
}

export interface EnrollmentTermRecord {
  id: number;
  enrollmentId: number;
  termNumber: number;
  startDate: string;
  plannedSessions: number | null;
  billingType: BillingType;
  tuitionAmount: number | null;
  tuitionDueDate: string | null;
  status: TermStatus;
}

function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return typeof value === "string" && (ENROLLMENT_STATUSES as readonly string[]).includes(value);
}
function isTermStatus(value: unknown): value is TermStatus {
  return typeof value === "string" && (TERM_STATUSES as readonly string[]).includes(value);
}
function isBillingType(value: unknown): value is BillingType {
  return typeof value === "string" && (BILLING_TYPES as readonly string[]).includes(value);
}
function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}
function isAttendanceMode(value: unknown): value is AttendanceMode {
  return typeof value === "string" && (ATTENDANCE_MODES as readonly string[]).includes(value);
}

export interface CreateEnrollmentInput {
  classId: number;
  studentId: number;
  enrolledAt?: string;
}

export async function createEnrollment(db: D1Database, input: CreateEnrollmentInput): Promise<number> {
  if (!Number.isInteger(input.classId) || !Number.isInteger(input.studentId)) {
    throw new Error("کلاس و هنرجو معتبر نیستند.");
  }

  const [classRow, student, existing] = await Promise.all([
    db.prepare("SELECT id, capacity, status FROM classes WHERE id = ?").bind(input.classId).first<{ id: number; capacity: number; status: string }>(),
    db.prepare("SELECT id FROM students WHERE id = ?").bind(input.studentId).first<{ id: number }>(),
    db.prepare("SELECT id FROM enrollments WHERE class_id = ? AND student_id = ? AND status = 'active'").bind(input.classId, input.studentId).first<{ id: number }>()
  ]);

  if (!classRow) throw new Error("کلاس یافت نشد.");
  if (classRow.status !== "active") throw new Error("ثبت‌نام در کلاس غیرفعال امکان‌پذیر نیست.");
  if (!student) throw new Error("هنرجو یافت نشد.");
  if (existing) throw new Error("این هنرجو از قبل در این کلاس ثبت‌نام فعال دارد.");

  const count = await db.prepare("SELECT COUNT(*) as count FROM enrollments WHERE class_id = ? AND status = 'active'").bind(input.classId).first<{ count: number }>();
  if ((count?.count ?? 0) >= classRow.capacity) throw new Error("ظرفیت این کلاس تکمیل شده است.");

  const result = await db.prepare(
    "INSERT INTO enrollments (class_id, student_id, enrolled_at) VALUES (?, ?, COALESCE(?, datetime('now')))"
  ).bind(input.classId, input.studentId, input.enrolledAt ?? null).run();

  if (typeof result.meta.last_row_id !== "number") throw new Error("ثبت‌نام ایجاد نشد.");
  return result.meta.last_row_id;
}

/**
 * Creates the first term lazily, when the first concrete session is known.
 * This is deliberately idempotent: repeated session generation must not
 * create duplicate terms.
 */
export async function ensureFirstEnrollmentTerm(
  db: D1Database,
  enrollmentId: number,
  firstSessionDate: string,
  options: { plannedSessions?: number | null; billingType?: BillingType; tuitionAmount?: number | null; tuitionDueDate?: string | null } = {}
): Promise<number> {
  const existing = await db.prepare(
    "SELECT id FROM enrollment_terms WHERE enrollment_id = ? ORDER BY term_number ASC LIMIT 1"
  ).bind(enrollmentId).first<{ id: number }>();
  if (existing) return existing.id;

  const billingType = options.billingType ?? "session_based";
  if (!isBillingType(billingType)) throw new Error("نوع محاسبه شهریه معتبر نیست.");
  if (options.plannedSessions !== undefined && options.plannedSessions !== null && (!Number.isInteger(options.plannedSessions) || options.plannedSessions < 1)) {
    throw new Error("تعداد جلسات باید حداقل ۱ باشد.");
  }

  const result = await db.prepare(`
    INSERT INTO enrollment_terms
      (enrollment_id, term_number, start_date, planned_sessions, billing_type, tuition_amount, tuition_due_date)
    VALUES (?, 1, ?, ?, ?, ?, ?)
  `).bind(
    enrollmentId,
    firstSessionDate,
    options.plannedSessions ?? null,
    billingType,
    options.tuitionAmount ?? null,
    options.tuitionDueDate ?? null
  ).run();

  if (typeof result.meta.last_row_id !== "number") throw new Error("چرخه آموزشی ایجاد نشد.");
  return result.meta.last_row_id;
}

export async function listEnrollmentTerms(db: D1Database, enrollmentId: number): Promise<EnrollmentTermRecord[]> {
  const rows = await db.prepare(`
    SELECT id, enrollment_id, term_number, start_date, planned_sessions, billing_type,
           tuition_amount, tuition_due_date, status
    FROM enrollment_terms
    WHERE enrollment_id = ?
    ORDER BY term_number ASC
  `).bind(enrollmentId).all<{
    id: number; enrollment_id: number; term_number: number; start_date: string;
    planned_sessions: number | null; billing_type: string; tuition_amount: number | null;
    tuition_due_date: string | null; status: string;
  }>();

  return rows.results.map(row => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    termNumber: row.term_number,
    startDate: row.start_date,
    plannedSessions: row.planned_sessions,
    billingType: isBillingType(row.billing_type) ? row.billing_type : "session_based",
    tuitionAmount: row.tuition_amount,
    tuitionDueDate: row.tuition_due_date,
    status: isTermStatus(row.status) ? row.status : "active"
  }));
}

export interface AttendanceRecord {
  id: number;
  enrollmentId: number;
  sessionId: number;
  status: AttendanceStatus;
  attendanceMode: AttendanceMode | null;
  makeupForId: number | null;
  note: string;
}

export async function setEnrollmentAttendance(
  db: D1Database,
  enrollmentId: number,
  sessionId: number,
  status: AttendanceStatus,
  attendanceMode?: AttendanceMode | null,
  note = ""
): Promise<number> {
  if (!isAttendanceStatus(status)) throw new Error("وضعیت حضور معتبر نیست.");
  if (attendanceMode !== undefined && attendanceMode !== null && !isAttendanceMode(attendanceMode)) {
    throw new Error("شیوه حضور معتبر نیست.");
  }

  const enrollment = await db.prepare("SELECT id, class_id, status FROM enrollments WHERE id = ?").bind(enrollmentId).first<{ id: number; class_id: number; status: string }>();
  const session = await db.prepare("SELECT id, class_id, status FROM class_sessions WHERE id = ?").bind(sessionId).first<{ id: number; class_id: number; status: string }>();
  if (!enrollment) throw new Error("ثبت‌نام یافت نشد.");
  if (!session) throw new Error("جلسه یافت نشد.");
  if (enrollment.class_id !== session.class_id) throw new Error("هنرجو متعلق به کلاس این جلسه نیست.");
  if (session.status === "cancelled") throw new Error("برای جلسه لغوشده نمی‌توان حضور ثبت کرد.");
  if (!isEnrollmentStatus(enrollment.status) || enrollment.status !== "active") throw new Error("ثبت حضور برای ثبت‌نام غیرفعال مجاز نیست.");

  const result = await db.prepare(`
    INSERT INTO enrollment_sessions (enrollment_id, session_id, status, attendance_mode, note)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(enrollment_id, session_id) DO UPDATE SET
      status = excluded.status,
      attendance_mode = excluded.attendance_mode,
      note = excluded.note,
      updated_at = datetime('now')
  `).bind(enrollmentId, sessionId, status, attendanceMode ?? null, note).run();

  const row = await db.prepare("SELECT id FROM enrollment_sessions WHERE enrollment_id = ? AND session_id = ?").bind(enrollmentId, sessionId).first<{ id: number }>();
  if (!row) throw new Error("وضعیت حضور ذخیره نشد.");
  return row.id;
}

export async function getEnrollmentSessionSummary(db: D1Database, enrollmentId: number, termId?: number | null) {
  const term = termId
    ? await db.prepare("SELECT id, planned_sessions FROM enrollment_terms WHERE id = ? AND enrollment_id = ?").bind(termId, enrollmentId).first<{ id: number; planned_sessions: number | null }>()
    : await db.prepare("SELECT id, planned_sessions FROM enrollment_terms WHERE enrollment_id = ? AND status = 'active' ORDER BY term_number DESC LIMIT 1").bind(enrollmentId).first<{ id: number; planned_sessions: number | null }>();

  if (!term) return { termId: null, plannedSessions: null, consumedSessions: 0, remainingSessions: null, present: 0, absent: 0, excused: 0 };

  const counts = await db.prepare(`
    SELECT
      SUM(CASE WHEN es.status = 'present' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN es.status = 'absent' THEN 1 ELSE 0 END) AS absent,
      SUM(CASE WHEN es.status = 'excused' THEN 1 ELSE 0 END) AS excused
    FROM enrollment_sessions es
    JOIN class_sessions cs ON cs.id = es.session_id
    WHERE es.enrollment_id = ?
      AND cs.session_date >= (SELECT start_date FROM enrollment_terms WHERE id = ?)
      AND cs.status != 'cancelled'
  `).bind(enrollmentId, term.id).first<{ present: number | null; absent: number | null; excused: number | null }>();

  const present = counts?.present ?? 0;
  const absent = counts?.absent ?? 0;
  const excused = counts?.excused ?? 0;
  const consumedSessions = present + absent;

  return {
    termId: term.id,
    plannedSessions: term.planned_sessions,
    consumedSessions,
    remainingSessions: term.planned_sessions === null ? null : Math.max(0, term.planned_sessions - consumedSessions),
    present,
    absent,
    excused
  };
}
