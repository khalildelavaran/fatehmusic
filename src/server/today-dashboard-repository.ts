export type TodayDashboardRow = {
  session_id:number; class_id:number; class_title:string; session_date:string; start_time:string; end_time:string;
  instructor_id:number; instructor_name:string; room_name:string|null; location_type:'in_person'|'online'|'hybrid';
  session_type:'regular'|'makeup'; session_status:'scheduled'|'completed'|'cancelled'; calendar_warning:string|null;
  teacher_attendance:'present'|'absent'|'pending';
};
export type TodayStudentRow = {
  enrollment_session_id:number; session_id:number; student_id:number; student_name:string;
  attendance:'pending'|'present'|'absent'|'excused'; consumed_sessions:number; planned_sessions:number|null;
  remaining_sessions:number|null; tuition_due_date:string|null; tuition_status:'paid'|'due'|'overdue'|'not_applicable';
};

export async function getTodayDashboardRows(db:D1Database,today:string):Promise<{sessions:TodayDashboardRow[];students:TodayStudentRow[]}> {
  const sessions=await db.prepare(`
    SELECT cs.id session_id,cs.class_id,c.title class_title,cs.session_date,cs.start_time,cs.end_time,
           cs.instructor_id,TRIM(i.first_name||' '||i.last_name) instructor_name,r.name room_name,
           cs.location_type,cs.type session_type,cs.status session_status,ce.type calendar_warning,
           COALESCE(tsa.status,'pending') teacher_attendance
    FROM class_sessions cs JOIN classes c ON c.id=cs.class_id JOIN instructors i ON i.id=cs.instructor_id
    LEFT JOIN rooms r ON r.id=cs.room_id LEFT JOIN calendar_exceptions ce ON ce.exception_date=cs.session_date
    LEFT JOIN teacher_session_attendance tsa ON tsa.session_id=cs.id AND tsa.instructor_id=cs.instructor_id
    WHERE cs.session_date=? ORDER BY cs.start_time,cs.id
  `).bind(today).all<TodayDashboardRow>();

  const students=await db.prepare(`
    SELECT es.id enrollment_session_id,es.session_id,s.id student_id,TRIM(s.first_name||' '||s.last_name) student_name,
           es.status attendance,
           COALESCE((
             SELECT SUM(CASE WHEN es2.status IN ('present','absent') AND cs2.status!='cancelled' THEN 1 ELSE 0 END)
             FROM enrollment_sessions es2
             JOIN class_sessions cs2 ON cs2.id=es2.session_id
             WHERE es2.enrollment_id=e.id
               AND es2.enrollment_term_id=et.id
           ),0) consumed_sessions,
           et.planned_sessions,
           CASE WHEN et.planned_sessions IS NULL THEN NULL ELSE MAX(0,et.planned_sessions-COALESCE((
             SELECT SUM(CASE WHEN es2.status IN ('present','absent') AND cs2.status!='cancelled' THEN 1 ELSE 0 END)
             FROM enrollment_sessions es2
             JOIN class_sessions cs2 ON cs2.id=es2.session_id
             WHERE es2.enrollment_id=e.id
               AND es2.enrollment_term_id=et.id
           ),0)) END remaining_sessions,
           et.tuition_due_date,
           CASE WHEN et.id IS NULL THEN 'not_applicable'
                WHEN EXISTS(SELECT 1 FROM invoices inv WHERE inv.enrollment_term_id=et.id AND inv.status='paid') THEN 'paid'
                WHEN et.tuition_due_date IS NOT NULL AND et.tuition_due_date < ? THEN 'overdue' ELSE 'due' END tuition_status
    FROM enrollment_sessions es JOIN enrollments e ON e.id=es.enrollment_id JOIN students s ON s.id=e.student_id
    JOIN class_sessions cs ON cs.id=es.session_id
    LEFT JOIN enrollment_terms et ON et.id=es.enrollment_term_id
    WHERE cs.session_date=? AND e.status='active' ORDER BY es.session_id,student_name
  `).bind(today,today).all<TodayStudentRow>();
  return {sessions:sessions.results,students:students.results};
}
