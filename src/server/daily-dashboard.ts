import { getEnrollmentProgress, type EnrollmentProgress } from './enrollment-progress';

export type DailyStudent = {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  enrollmentSessionId: number | null;
  attendanceStatus: 'pending' | 'present' | 'absent' | 'excused' | null;
  progress: EnrollmentProgress | null;
};

export type DailySession = {
  sessionId: number;
  classId: number;
  className: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  instructorId: number;
  instructorName: string;
  roomId: number | null;
  roomName: string | null;
  status: string;
  type: string;
  students: DailyStudent[];
};

type SessionRow = {
  session_id: number;
  class_id: number;
  class_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  instructor_id: number;
  instructor_name: string;
  room_id: number | null;
  room_name: string | null;
  session_status: string;
  session_type: string;
};

type StudentRow = {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  enrollment_session_id: number | null;
  attendance_status: 'pending' | 'present' | 'absent' | 'excused' | null;
};

export async function getDailyDashboard(db: D1Database, date: string): Promise<DailySession[]> {
  const sessions = await db.prepare(`
    SELECT
      cs.id AS session_id,
      cs.class_id,
      c.title AS class_name,
      cs.session_date,
      cs.start_time,
      cs.end_time,
      cs.instructor_id,
      TRIM(COALESCE(i.first_name, '') || ' ' || COALESCE(i.last_name, '')) AS instructor_name,
      cs.room_id,
      r.name AS room_name,
      cs.status AS session_status,
      cs.type AS session_type
    FROM class_sessions cs
    JOIN classes c ON c.id = cs.class_id
    JOIN instructors i ON i.id = cs.instructor_id
    LEFT JOIN rooms r ON r.id = cs.room_id
    WHERE cs.session_date = ?
    ORDER BY cs.start_time, cs.id
  `).bind(date).all<SessionRow>();

  const result: DailySession[] = [];

  for (const session of sessions.results) {
    const students = await db.prepare(`
      SELECT
        e.id AS enrollment_id,
        e.student_id,
        TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')) AS student_name,
        es.id AS enrollment_session_id,
        es.status AS attendance_status
      FROM enrollments e
      JOIN students st ON st.id = e.student_id
      LEFT JOIN enrollment_sessions es
        ON es.enrollment_id = e.id
       AND es.session_id = ?
      WHERE e.class_id = ?
        AND e.status = 'active'
      ORDER BY st.last_name, st.first_name, e.id
    `).bind(session.session_id, session.class_id).all<StudentRow>();

    const mappedStudents: DailyStudent[] = [];
    for (const row of students.results) {
      mappedStudents.push({
        enrollmentId: row.enrollment_id,
        studentId: row.student_id,
        studentName: row.student_name || 'هنرجو',
        enrollmentSessionId: row.enrollment_session_id,
        attendanceStatus: row.attendance_status,
        progress: await getEnrollmentProgress(db, row.enrollment_id),
      });
    }

    result.push({
      sessionId: session.session_id,
      classId: session.class_id,
      className: session.class_name,
      sessionDate: session.session_date,
      startTime: session.start_time,
      endTime: session.end_time,
      instructorId: session.instructor_id,
      instructorName: session.instructor_name || 'مدرس',
      roomId: session.room_id,
      roomName: session.room_name,
      status: session.session_status,
      type: session.session_type,
      students: mappedStudents,
    });
  }

  return result;
}
