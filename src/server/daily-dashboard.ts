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
  session_id:number; class_id:number; class_name:string; session_date:string;
  start_time:string; end_time:string; instructor_id:number; instructor_name:string;
  room_id:number|null; room_name:string|null; session_status:string; session_type:string;
};

type StudentRow = {
  enrollment_id:number; student_id:number; student_name:string;
  enrollment_session_id:number|null; attendance_status:'pending'|'present'|'absent'|'excused'|null;
};

export async function getDailyDashboard(db:D1Database,date:string):Promise<DailySession[]> {
  const sessions = await db.prepare(`
    SELECT cs.id session_id, cs.class_id, c.title class_name,
           cs.session_date, cs.start_time, cs.end_time,
           cs.instructor_id,
           COALESCE(i.name, i.full_name, 'مدرس') instructor_name,
           cs.room_id, r.name room_name,
           cs.status session_status, cs.type session_type
    FROM class_sessions cs
    JOIN classes c ON c.id = cs.class_id
    LEFT JOIN instructors i ON i.id = cs.instructor_id
    LEFT JOIN rooms r ON r.id = cs.room_id
    WHERE cs.session_date = ?
    ORDER BY cs.start_time, cs.id
  `).bind(date).all<SessionRow>();

  const result:DailySession[]=[];
  for (const s of sessions.results) {
    const students = await db.prepare(`
      SELECT e.id enrollment_id, e.student_id,
             COALESCE(st.name, st.full_name, 'هنرجو') student_name,
             es.id enrollment_session_id, es.status attendance_status
      FROM enrollments e
      JOIN students st ON st.id = e.student_id
      LEFT JOIN enrollment_sessions es
        ON es.enrollment_id=e.id AND es.session_id=?
      WHERE e.class_id=? AND e.status='active'
      ORDER BY student_name, e.id
    `).bind(s.session_id,s.class_id).all<StudentRow>();

    const mapped:DailyStudent[]=[];
    for (const row of students.results) {
      mapped.push({
        enrollmentId:row.enrollment_id,
        studentId:row.student_id,
        studentName:row.student_name,
        enrollmentSessionId:row.enrollment_session_id,
        attendanceStatus:row.attendance_status,
        progress:await getEnrollmentProgress(db,row.enrollment_id),
      });
    }

    result.push({
      sessionId:s.session_id,classId:s.class_id,className:s.class_name,
      sessionDate:s.session_date,startTime:s.start_time,endTime:s.end_time,
      instructorId:s.instructor_id,instructorName:s.instructor_name,
      roomId:s.room_id,roomName:s.room_name,status:s.session_status,
      type:s.session_type,students:mapped,
    });
  }
  return result;
}
