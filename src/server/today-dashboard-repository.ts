export type TodayDashboardRow = {
  session_id: number;
  class_id: number;
  class_title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  instructor_id: number;
  instructor_name: string;
  room_name: string | null;
  location_type: 'in_person' | 'online' | 'hybrid';
  session_type: 'regular' | 'makeup';
  session_status: 'scheduled' | 'completed' | 'cancelled';
  calendar_warning: string | null;
};

export type TodayStudentRow = {
  enrollment_session_id: number;
  session_id: number;
  student_id: number;
  student_name: string;
  attendance: 'present' | 'absent' | 'excused';
  consumed_sessions: number;
  planned_sessions: number | null;
  remaining_sessions: number | null;
  tuition_due_date: string | null;
  tuition_status: 'paid' | 'due' | 'overdue' | 'not_applicable';
};

/**
 * D1 repository for the secretary's same-day view.
 * `today` must be an ISO local calendar date (YYYY-MM-DD).
 */
export async function getTodayDashboardRows(
  db: D1Database,
  today: string,
): Promise<{ sessions: TodayDashboardRow[]; students: TodayStudentRow[] }> {
  const sessions = await db.prepare(`
    SELECT
      cs.id AS session_id,
      cs.class_id,
      c.title AS class_title,
      cs.session_date,
      cs.start_time,
      cs.end_time,
      cs.instructor_id,
      TRIM(i.first_name || ' ' || i.last_name) AS instructor_name,
      r.name AS room_name,
      cs.location_type,
      cs.type AS session_type,
      cs.status AS session_status,
      ce.type AS calendar_warning
    FROM class_sessions cs
    JOIN classes c ON c.id = cs.class_id
    JOIN instructors i ON i.id = cs.instructor_id
    LEFT JOIN rooms r ON r.id = cs.room_id
    LEFT JOIN calendar_exceptions ce ON ce.exception_date = cs.session_date
    WHERE cs.session_date = ?
    ORDER BY cs.start_time, cs.id
  `).bind(today).all<TodayDashboardRow>();

  const students = await db.prepare(`
    SELECT
      es.id AS enrollment_session_id,
      es.session_id,
      s.id AS student_id,
      TRIM(s.first_name || ' ' || s.last_name) AS student_name,
      es.status AS attendance,
      COALESCE(SUM(
        CASE WHEN es2.status IN ('present', 'absent')
                  AND cs2.status != 'cancelled' THEN 1 ELSE 0 END
      ), 0) AS consumed_sessions,
      et.planned_sessions,
      CASE
        WHEN et.planned_sessions IS NULL THEN NULL
        ELSE MAX(0, et.planned_sessions - COALESCE(SUM(
          CASE WHEN es2.status IN ('present', 'absent')
                    AND cs2.status != 'cancelled' THEN 1 ELSE 0 END
        ), 0))
      END AS remaining_sessions,
      et.tuition_due_date,
      CASE
        WHEN et.billing_type != 'monthly' AND et.tuition_due_date IS NULL THEN 'not_applicable'
        WHEN EXISTS (
          SELECT 1 FROM invoices inv
          WHERE inv.enrollment_term_id = et.id
            AND inv.status = 'paid'
        ) THEN 'paid'
        WHEN et.tuition_due_date < ? THEN 'overdue'
        ELSE 'due'
      END AS tuition_status
    FROM enrollment_sessions es
    JOIN enrollments e ON e.id = es.enrollment_id
    JOIN students s ON s.id = e.student_id
    JOIN class_sessions cs ON cs.id = es.session_id
    LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
    LEFT JOIN enrollment_sessions es2 ON es2.enrollment_id = e.id
    LEFT JOIN class_sessions cs2 ON cs2.id = es2.session_id
    WHERE cs.session_date = ?
      AND e.status = 'active'
    GROUP BY es.id, es.session_id, s.id, s.first_name, s.last_name,
             es.status, et.id, et.planned_sessions, et.tuition_due_date,
             et.billing_type
    ORDER BY es.session_id, student_name
  `).bind(today, today).all<TodayStudentRow>();

  return { sessions: sessions.results, students: students.results };
}
