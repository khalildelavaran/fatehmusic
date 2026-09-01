import { listSessionsForDate, type ClassSessionRecord } from "./class-sessions";

export interface TodayStudentCard {
  enrollmentId: number;
  studentId: number;
  firstName: string;
  lastName: string;
  status: "present" | "absent" | "excused" | "pending";
  attendanceMode: "in_person" | "online" | null;
  consumedSessions: number;
  remainingSessions: number | null;
  plannedSessions: number | null;
  tuitionDueDate: string | null;
  tuitionStatus: "paid" | "pending" | "overdue" | "none";
}

export interface TodaySessionCard extends ClassSessionRecord {
  classTitle: string;
  instructorName: string;
  students: TodayStudentCard[];
}

interface SessionContextRow {
  id: number;
  class_title: string;
  instructor_first_name: string;
  instructor_last_name: string;
}

interface StudentRow {
  enrollment_id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  attendance_status: string | null;
  attendance_mode: string | null;
  term_id: number | null;
  planned_sessions: number | null;
  tuition_due_date: string | null;
  tuition_status: string | null;
  consumed_sessions: number;
}

function attendanceStatus(value: string | null): TodayStudentCard["status"] {
  if (value === "present" || value === "absent" || value === "excused") return value;
  return "pending";
}

function tuitionStatus(value: string | null): TodayStudentCard["tuitionStatus"] {
  if (value === "paid" || value === "pending" || value === "overdue") return value;
  return "none";
}

export async function getTodayDashboard(db: D1Database, date: string): Promise<TodaySessionCard[]> {
  const sessions = await listSessionsForDate(db, date);
  if (!sessions.length) return [];

  return Promise.all(sessions.map(async session => {
    const context = await db.prepare(`
      SELECT cs.id, cs.title AS class_title,
             i.first_name AS instructor_first_name,
             i.last_name AS instructor_last_name
      FROM classes cs
      JOIN instructors i ON i.id = cs.instructor_id
      WHERE cs.id = ?
    `).bind(session.classId).first<SessionContextRow>();

    const students = await db.prepare(`
      SELECT
        e.id AS enrollment_id,
        s.id AS student_id,
        s.first_name,
        s.last_name,
        es.status AS attendance_status,
        es.attendance_mode,
        et.id AS term_id,
        et.planned_sessions,
        et.tuition_due_date,
        (
          SELECT CASE
            WHEN COUNT(*) = 0 THEN 'none'
            WHEN SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) > 0 THEN 'overdue'
            WHEN SUM(CASE WHEN i.status = 'pending' THEN 1 ELSE 0 END) > 0 THEN 'pending'
            ELSE 'paid'
          END
          FROM invoices i
          WHERE i.enrollment_term_id = et.id
            AND i.status != 'cancelled'
        ) AS tuition_status,
        (
          SELECT COUNT(*)
          FROM enrollment_sessions es2
          JOIN class_sessions cs2 ON cs2.id = es2.session_id
          WHERE es2.enrollment_id = e.id
            AND es2.enrollment_term_id = et.id
            AND es2.status IN ('present', 'absent')
            AND cs2.status != 'cancelled'
        ) AS consumed_sessions
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      LEFT JOIN enrollment_sessions es
        ON es.enrollment_id = e.id AND es.session_id = ?
      LEFT JOIN enrollment_terms et
        ON et.id = (
          SELECT et2.id FROM enrollment_terms et2
          WHERE et2.enrollment_id = e.id AND et2.status = 'active'
          ORDER BY et2.term_number DESC LIMIT 1
        )
      WHERE e.class_id = ? AND e.status = 'active'
      ORDER BY s.first_name, s.last_name
    `).bind(session.id, session.classId).all<StudentRow>();

    return {
      ...session,
      classTitle: context?.class_title ?? "-",
      instructorName: context ? `${context.instructor_first_name} ${context.instructor_last_name}`.trim() : "-",
      students: students.results.map(student => ({
        enrollmentId: student.enrollment_id,
        studentId: student.student_id,
        firstName: student.first_name,
        lastName: student.last_name,
        status: attendanceStatus(student.attendance_status),
        attendanceMode: student.attendance_mode === "online" ? "online" : student.attendance_mode === "in_person" ? "in_person" : null,
        consumedSessions: student.consumed_sessions ?? 0,
        remainingSessions: student.planned_sessions === null || student.planned_sessions === undefined
          ? null
          : Math.max(0, student.planned_sessions - (student.consumed_sessions ?? 0)),
        plannedSessions: student.planned_sessions,
        tuitionDueDate: student.tuition_due_date,
        tuitionStatus: tuitionStatus(student.tuition_status)
      }))
    };
  }));
}
