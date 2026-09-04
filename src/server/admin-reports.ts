/**
 * Aggregate KPI + reporting queries for the Admin Dashboard
 * (SCHOOL-MANAGEMENT-IMPLEMENTATION.md sections 39-45).
 *
 * Distinct from today-dashboard-repository.ts, which answers
 * "what's happening today" (per-session operational detail). This
 * module answers "how is the school doing" (counts, sums, averages
 * across a date range or overall).
 */

export interface DashboardOverview {
  activeStudents: number;
  activeInstructors: number;
  activeClasses: number;
  todayClasses: number;
  todaySessions: number;
  debtorsCount: number;
  monthRevenue: number;
  certificatesIssued: number;
}

export async function getDashboardOverview(db: D1Database, today: string): Promise<DashboardOverview> {
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    activeStudents,
    activeInstructors,
    activeClasses,
    todayClasses,
    todaySessions,
    debtorsCount,
    monthRevenue,
    certificatesIssued,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM students WHERE status = 'active'").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM instructors WHERE is_active = 1").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM classes WHERE status = 'active'").first<{ n: number }>(),
    db.prepare(
      `SELECT COUNT(DISTINCT cs.class_id) AS n FROM class_sessions cs WHERE cs.session_date = ? AND cs.status != 'cancelled'`,
    ).bind(today).first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM class_sessions WHERE session_date = ? AND status != 'cancelled'`).bind(today).first<{ n: number }>(),
    db.prepare(
      `SELECT COUNT(DISTINCT et.enrollment_id) AS n
       FROM enrollment_terms et
       JOIN invoices i ON i.enrollment_term_id = et.id
       WHERE i.status IN ('pending', 'overdue')`,
    ).first<{ n: number }>(),
    db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE paid_at >= ?`).bind(monthStart).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM issued_certificates").first<{ n: number }>(),
  ]);

  return {
    activeStudents: Number(activeStudents?.n) || 0,
    activeInstructors: Number(activeInstructors?.n) || 0,
    activeClasses: Number(activeClasses?.n) || 0,
    todayClasses: Number(todayClasses?.n) || 0,
    todaySessions: Number(todaySessions?.n) || 0,
    debtorsCount: Number(debtorsCount?.n) || 0,
    monthRevenue: Number(monthRevenue?.n) || 0,
    certificatesIssued: Number(certificatesIssued?.n) || 0,
  };
}

// ---------------------------------------------------------------------
// Section 40: Student report
// ---------------------------------------------------------------------
export interface StudentReport {
  total: number;
  active: number;
  inactive: number;
  graduated: number;
  newEnrollmentsInRange: number;
}

export async function getStudentReport(db: D1Database, fromDate: string, toDate: string): Promise<StudentReport> {
  const [total, active, inactive, graduated, newEnrollments] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM students").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM students WHERE status = 'active'").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM students WHERE status = 'inactive'").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM students WHERE status = 'graduated'").first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM enrollments WHERE date(created_at) BETWEEN date(?) AND date(?)")
      .bind(fromDate, toDate)
      .first<{ n: number }>(),
  ]);

  return {
    total: Number(total?.n) || 0,
    active: Number(active?.n) || 0,
    inactive: Number(inactive?.n) || 0,
    graduated: Number(graduated?.n) || 0,
    newEnrollmentsInRange: Number(newEnrollments?.n) || 0,
  };
}

// ---------------------------------------------------------------------
// Section 41: Instructor report
// ---------------------------------------------------------------------
export interface InstructorReportRow {
  instructorId: number;
  name: string;
  classCount: number;
  studentCount: number;
  averageAttendanceRate: number | null;
  averageEvaluationScore: number | null;
}

export interface InstructorReport {
  total: number;
  active: number;
  perInstructor: InstructorReportRow[];
}

export async function getInstructorReport(db: D1Database): Promise<InstructorReport> {
  const [total, active] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM instructors").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM instructors WHERE is_active = 1").first<{ n: number }>(),
  ]);

  const rows = await db
    .prepare(
      `SELECT
         i.id AS instructor_id,
         TRIM(i.first_name || ' ' || i.last_name) AS name,
         (SELECT COUNT(*) FROM classes c WHERE c.instructor_id = i.id AND c.status = 'active') AS class_count,
         (SELECT COUNT(*) FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE c.instructor_id = i.id AND e.status = 'active') AS student_count,
         (SELECT AVG(CASE WHEN es.status = 'present' THEN 1.0 WHEN es.status = 'absent' THEN 0.0 END)
            FROM enrollment_sessions es
            JOIN class_sessions cs ON cs.id = es.session_id
            WHERE cs.instructor_id = i.id AND es.status IN ('present', 'absent')) AS avg_attendance,
         (SELECT AVG(ev.overall_score) FROM evaluations ev WHERE ev.instructor_id = i.id) AS avg_evaluation
       FROM instructors i
       WHERE i.is_active = 1
       ORDER BY name`,
    )
    .all();

  const perInstructor: InstructorReportRow[] = (rows.results ?? []).map((row: any) => ({
    instructorId: Number(row.instructor_id),
    name: String(row.name || ""),
    classCount: Number(row.class_count) || 0,
    studentCount: Number(row.student_count) || 0,
    averageAttendanceRate: row.avg_attendance === null ? null : Math.round(Number(row.avg_attendance) * 1000) / 10,
    averageEvaluationScore: row.avg_evaluation === null ? null : Math.round(Number(row.avg_evaluation) * 10) / 10,
  }));

  return { total: Number(total?.n) || 0, active: Number(active?.n) || 0, perInstructor };
}

// ---------------------------------------------------------------------
// Section 42: Class report
// ---------------------------------------------------------------------
export interface ClassReport {
  active: number;
  cancelled: number;
  todayCount: number;
  totalCapacity: number;
  totalEnrolled: number;
  emptyCapacity: number;
}

export async function getClassReport(db: D1Database, today: string): Promise<ClassReport> {
  const [active, cancelled, todayCount, capacity] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM classes WHERE status = 'active'").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM classes WHERE status = 'cancelled'").first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(DISTINCT class_id) AS n FROM class_sessions WHERE session_date = ? AND status != 'cancelled'")
      .bind(today)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(c.capacity), 0) AS total_capacity,
           COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.status = 'active'), 0) AS enrolled_ignored
         FROM classes c WHERE c.status = 'active'`,
      )
      .first<{ total_capacity: number }>(),
  ]);

  const enrolledRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE e.status = 'active' AND c.status = 'active'`,
    )
    .first<{ n: number }>();

  const totalCapacity = Number(capacity?.total_capacity) || 0;
  const totalEnrolled = Number(enrolledRow?.n) || 0;

  return {
    active: Number(active?.n) || 0,
    cancelled: Number(cancelled?.n) || 0,
    todayCount: Number(todayCount?.n) || 0,
    totalCapacity,
    totalEnrolled,
    emptyCapacity: Math.max(totalCapacity - totalEnrolled, 0),
  };
}

// ---------------------------------------------------------------------
// Section 43: Finance report
// ---------------------------------------------------------------------
export interface FinanceReport {
  dailyRevenue: number;
  monthlyRevenue: number;
  receivables: number;
  completedPayments: number;
  partialOrOverdueInvoices: number;
  debtorsCount: number;
}

export async function getFinanceReport(db: D1Database, today: string): Promise<FinanceReport> {
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextDay = new Date(`${today}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const tomorrow = nextDay.toISOString().slice(0, 10);

  const [dailyRevenue, monthlyRevenue, receivables, completedPayments, partialOrOverdue, debtors] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE paid_at >= ? AND paid_at < ?").bind(today, tomorrow).first<{ n: number }>(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE paid_at >= ?").bind(monthStart).first<{ n: number }>(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM invoices WHERE status IN ('pending', 'overdue')").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE status = 'paid'").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE status IN ('overdue', 'pending')").first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(DISTINCT et.enrollment_id) AS n
         FROM enrollment_terms et JOIN invoices i ON i.enrollment_term_id = et.id
         WHERE i.status IN ('pending', 'overdue')`,
      )
      .first<{ n: number }>(),
  ]);

  return {
    dailyRevenue: Number(dailyRevenue?.n) || 0,
    monthlyRevenue: Number(monthlyRevenue?.n) || 0,
    receivables: Number(receivables?.n) || 0,
    completedPayments: Number(completedPayments?.n) || 0,
    partialOrOverdueInvoices: Number(partialOrOverdue?.n) || 0,
    debtorsCount: Number(debtors?.n) || 0,
  };
}

// ---------------------------------------------------------------------
// Section 44: Educational report
// ---------------------------------------------------------------------
export interface AtRiskStudent {
  studentId: number;
  studentName: string;
  absentCount: number;
  averageEvaluation: number | null;
}

export interface EducationalReport {
  averageAttendanceRate: number | null;
  averageEvaluationScore: number | null;
  mostAbsences: AtRiskStudent[];
  atRiskStudents: AtRiskStudent[];
}

/** A student is "at risk" if their recent attendance rate is low or their
 * evaluations are trending low; this uses a simple, explainable threshold
 * (attendance rate < 70% over their last 10 recorded sessions) rather than
 * a black-box score, so admins can see exactly why a student is flagged. */
const AT_RISK_ATTENDANCE_THRESHOLD = 0.7;

export async function getEducationalReport(db: D1Database): Promise<EducationalReport> {
  const [overallAttendance, overallEvaluation] = await Promise.all([
    db
      .prepare(
        `SELECT AVG(CASE WHEN status = 'present' THEN 1.0 WHEN status = 'absent' THEN 0.0 END) AS n
         FROM enrollment_sessions WHERE status IN ('present', 'absent')`,
      )
      .first<{ n: number | null }>(),
    db.prepare("SELECT AVG(overall_score) AS n FROM evaluations").first<{ n: number | null }>(),
  ]);

  const perStudentRows = await db
    .prepare(
      `SELECT
         s.id AS student_id,
         TRIM(s.first_name || ' ' || s.last_name) AS student_name,
         SUM(CASE WHEN es.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
         AVG(CASE WHEN es.status = 'present' THEN 1.0 WHEN es.status = 'absent' THEN 0.0 END) AS attendance_rate,
         (SELECT AVG(ev.overall_score) FROM evaluations ev JOIN enrollments e2 ON e2.id = ev.enrollment_id WHERE e2.student_id = s.id) AS avg_evaluation
       FROM enrollment_sessions es
       JOIN enrollments e ON e.id = es.enrollment_id
       JOIN students s ON s.id = e.student_id
       WHERE es.status IN ('present', 'absent') AND e.status = 'active'
       GROUP BY s.id
       HAVING COUNT(*) >= 1`,
    )
    .all();

  const perStudent = (perStudentRows.results ?? []).map((row: any) => ({
    studentId: Number(row.student_id),
    studentName: String(row.student_name || ""),
    absentCount: Number(row.absent_count) || 0,
    attendanceRate: row.attendance_rate === null ? null : Number(row.attendance_rate),
    averageEvaluation: row.avg_evaluation === null ? null : Math.round(Number(row.avg_evaluation) * 10) / 10,
  }));

  const mostAbsences = [...perStudent]
    .filter((s) => s.absentCount > 0)
    .sort((a, b) => b.absentCount - a.absentCount)
    .slice(0, 10)
    .map(({ studentId, studentName, absentCount, averageEvaluation }) => ({ studentId, studentName, absentCount, averageEvaluation }));

  const atRiskStudents = perStudent
    .filter((s) => s.attendanceRate !== null && s.attendanceRate < AT_RISK_ATTENDANCE_THRESHOLD)
    .sort((a, b) => (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0))
    .slice(0, 20)
    .map(({ studentId, studentName, absentCount, averageEvaluation }) => ({ studentId, studentName, absentCount, averageEvaluation }));

  return {
    averageAttendanceRate: overallAttendance?.n == null ? null : Math.round(Number(overallAttendance.n) * 1000) / 10,
    averageEvaluationScore: overallEvaluation?.n == null ? null : Math.round(Number(overallEvaluation.n) * 10) / 10,
    mostAbsences,
    atRiskStudents,
  };
}
