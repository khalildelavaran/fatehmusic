import type { TodayDashboardRow, TodayStudentRow } from "./today-dashboard-repository";

export interface InstructorProfileSummary {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  specialty: string;
  instruments: string[];
  biography: string;
  mustChangePassword: boolean;
}

export interface InstructorClassSummary {
  classId: number;
  title: string;
  courseId: number;
  room: string | null;
  classType: string;
  capacity: number | null;
  level: string | null;
  status: string;
  studentCount: number;
}

export interface InstructorStudentSummary {
  studentId: number;
  firstName: string;
  lastName: string;
  classId: number;
  classTitle: string;
  enrollmentStatus: string;
  enrollmentId: number;
}

export interface PendingAssignmentSummary {
  id: number;
  enrollmentId: number;
  studentName: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export async function getInstructorProfile(db: D1Database, instructorId: number, mustChangePassword: boolean): Promise<InstructorProfileSummary | null> {
  const row = await db
    .prepare("SELECT id, first_name, last_name, phone, email, specialty, instruments, biography FROM instructors WHERE id = ?")
    .bind(instructorId)
    .first<{ id: number; first_name: string; last_name: string; phone: string; email: string; specialty: string; instruments: string; biography: string }>();
  if (!row) return null;
  let instruments: string[] = [];
  try {
    const parsed = JSON.parse(row.instruments || "[]");
    if (Array.isArray(parsed)) instruments = parsed.filter((x) => typeof x === "string");
  } catch {
    instruments = [];
  }
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    specialty: row.specialty,
    instruments,
    biography: row.biography,
    mustChangePassword,
  };
}

export async function listInstructorClasses(db: D1Database, instructorId: number): Promise<InstructorClassSummary[]> {
  const rows = await db
    .prepare(
      `SELECT c.id class_id, c.title, c.course_id, c.room, c.class_type, c.capacity, c.level, c.status,
              (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.status = 'active') AS student_count
       FROM classes c
       WHERE c.instructor_id = ?
       ORDER BY c.status DESC, c.title`,
    )
    .bind(instructorId)
    .all();
  return (rows.results ?? []).map((row: any) => ({
    classId: Number(row.class_id),
    title: String(row.title || ""),
    courseId: Number(row.course_id),
    room: row.room ?? null,
    classType: String(row.class_type || ""),
    capacity: row.capacity === null ? null : Number(row.capacity),
    level: row.level ?? null,
    status: String(row.status || ""),
    studentCount: Number(row.student_count) || 0,
  }));
}

export async function listInstructorStudents(db: D1Database, instructorId: number, search?: string | null): Promise<InstructorStudentSummary[]> {
  const term = search ? `%${search.trim()}%` : null;
  const sql = `
    SELECT e.id enrollment_id, s.id student_id, s.first_name, s.last_name, e.class_id, c.title class_title, e.status enrollment_status
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN classes c ON c.id = e.class_id
    WHERE c.instructor_id = ?
    ${term ? "AND (s.first_name || ' ' || s.last_name) LIKE ?" : ""}
    ORDER BY e.status DESC, s.first_name, s.last_name
  `;
  const statement = term ? db.prepare(sql).bind(instructorId, term) : db.prepare(sql).bind(instructorId);
  const rows = await statement.all();
  return (rows.results ?? []).map((row: any) => ({
    studentId: Number(row.student_id),
    firstName: String(row.first_name || ""),
    lastName: String(row.last_name || ""),
    classId: Number(row.class_id),
    classTitle: String(row.class_title || ""),
    enrollmentStatus: String(row.enrollment_status || ""),
    enrollmentId: Number(row.enrollment_id),
  }));
}

/**
 * Same shape as the admin today-dashboard, scoped to one instructor's own
 * sessions. Reuses the same join structure as today-dashboard-repository
 * but filters at the SQL layer rather than post-filtering, so an
 * instructor never receives another instructor's session/student rows.
 */
export async function getInstructorTodayDashboard(
  db: D1Database,
  instructorId: number,
  today: string,
): Promise<{ sessions: TodayDashboardRow[]; students: TodayStudentRow[] }> {
  const sessions = await db
    .prepare(
      `SELECT cs.id session_id, cs.class_id, c.title class_title, cs.session_date, cs.start_time, cs.end_time,
              cs.instructor_id, TRIM(i.first_name || ' ' || i.last_name) instructor_name, r.name room_name,
              cs.location_type, cs.type session_type, cs.status session_status, ce.type calendar_warning,
              COALESCE(tsa.status, 'pending') teacher_attendance
       FROM class_sessions cs
       JOIN classes c ON c.id = cs.class_id
       JOIN instructors i ON i.id = cs.instructor_id
       LEFT JOIN rooms r ON r.id = cs.room_id
       LEFT JOIN calendar_exceptions ce ON ce.exception_date = cs.session_date
       LEFT JOIN teacher_session_attendance tsa ON tsa.session_id = cs.id AND tsa.instructor_id = cs.instructor_id
       WHERE cs.session_date = ? AND cs.instructor_id = ?
       ORDER BY cs.start_time, cs.id`,
    )
    .bind(today, instructorId)
    .all<TodayDashboardRow>();

  const students = await db
    .prepare(
      `SELECT es.id enrollment_session_id, es.session_id, s.id student_id, TRIM(s.first_name || ' ' || s.last_name) student_name,
              es.status attendance,
              COALESCE((
                SELECT SUM(CASE WHEN es2.status IN ('present','absent') AND cs2.status != 'cancelled' THEN 1 ELSE 0 END)
                FROM enrollment_sessions es2
                JOIN class_sessions cs2 ON cs2.id = es2.session_id
                WHERE es2.enrollment_id = e.id AND es2.enrollment_term_id = et.id
              ), 0) consumed_sessions,
              et.planned_sessions,
              CASE WHEN et.planned_sessions IS NULL THEN NULL ELSE MAX(0, et.planned_sessions - COALESCE((
                SELECT SUM(CASE WHEN es2.status IN ('present','absent') AND cs2.status != 'cancelled' THEN 1 ELSE 0 END)
                FROM enrollment_sessions es2
                JOIN class_sessions cs2 ON cs2.id = es2.session_id
                WHERE es2.enrollment_id = e.id AND es2.enrollment_term_id = et.id
              ), 0)) END remaining_sessions,
              et.tuition_due_date,
              CASE WHEN et.id IS NULL THEN 'not_applicable'
                   WHEN EXISTS(SELECT 1 FROM invoices inv WHERE inv.enrollment_term_id = et.id AND inv.status = 'paid') THEN 'paid'
                   WHEN et.tuition_due_date IS NOT NULL AND et.tuition_due_date < ? THEN 'overdue' ELSE 'due' END tuition_status
       FROM enrollment_sessions es
       JOIN enrollments e ON e.id = es.enrollment_id
       JOIN students s ON s.id = e.student_id
       JOIN class_sessions cs ON cs.id = es.session_id
       LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
       WHERE cs.session_date = ? AND cs.instructor_id = ? AND e.status = 'active'
       ORDER BY es.session_id, student_name`,
    )
    .bind(today, today, instructorId)
    .all<TodayStudentRow>();

  return { sessions: sessions.results ?? [], students: students.results ?? [] };
}

export async function listPendingAssignments(db: D1Database, instructorId: number): Promise<PendingAssignmentSummary[]> {
  const rows = await db
    .prepare(
      `SELECT a.id, a.enrollment_id, TRIM(s.first_name || ' ' || s.last_name) student_name, a.title, a.status, a.due_date
       FROM assignments a
       JOIN enrollments e ON e.id = a.enrollment_id
       JOIN students s ON s.id = e.student_id
       WHERE a.instructor_id = ? AND a.status = 'completed'
       ORDER BY a.due_date IS NULL, a.due_date, a.id`,
    )
    .bind(instructorId)
    .all();
  return (rows.results ?? []).map((row: any) => ({
    id: Number(row.id),
    enrollmentId: Number(row.enrollment_id),
    studentName: String(row.student_name || ""),
    title: String(row.title || ""),
    status: String(row.status || ""),
    dueDate: row.due_date ?? null,
  }));
}

/**
 * Authorization guard shared by every instructor-portal write endpoint:
 * confirms the enrollment's class actually belongs to this instructor.
 * Must be checked server-side before any evaluation/assignment/attendance
 * write, per SCHOOL-MANAGEMENT-IMPLEMENTATION.md section 49.
 */
export async function instructorOwnsEnrollment(db: D1Database, instructorId: number, enrollmentId: number): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE e.id = ? AND c.instructor_id = ?`,
    )
    .bind(enrollmentId, instructorId)
    .first();
  return Boolean(row);
}

export async function instructorOwnsSession(db: D1Database, instructorId: number, sessionId: number): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 FROM class_sessions WHERE id = ? AND instructor_id = ?`)
    .bind(sessionId, instructorId)
    .first();
  return Boolean(row);
}
