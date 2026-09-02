export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";
import { provisionEnrollmentSessionsForClassSession } from "../../../server/session-provisioning";

export const GET: APIRoute = async ({ request }) => {
  try {
    const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
    if (denied) return denied;
    const db = env.DB;
    if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ success: false, message: "ماه معتبر نیست." }, 422);
    const startDate = `${month}-01`;
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, monthNumber, 1));
    const endDate = next.toISOString().slice(0, 10);

    const monthSessions = await db.prepare(`
      SELECT id FROM class_sessions
      WHERE session_date >= ? AND session_date < ? AND status <> 'cancelled'
      ORDER BY session_date, start_time, id
    `).bind(startDate, endDate).all<{ id: number }>();
    for (const session of monthSessions.results) {
      try { await provisionEnrollmentSessionsForClassSession(db, session.id); }
      catch (error) { console.warn(`[admin/teacher-workload] session ${session.id} provisioning skipped:`, error); }
    }

    const instructorRows = await db.prepare(`
      SELECT id, first_name, last_name, pay_percentage
      FROM instructors
      WHERE is_active = 1
      ORDER BY first_name, last_name, id
    `).all<{ id: number; first_name: string; last_name: string; pay_percentage: number | null }>();

    const workRows = await db.prepare(`
      SELECT
        cs.instructor_id,
        COUNT(DISTINCT cs.id) AS class_sessions,
        SUM(CASE WHEN es.status IN ('present', 'absent') THEN 1 ELSE 0 END) AS student_sessions,
        SUM(CASE WHEN es.status = 'present' THEN 1 ELSE 0 END) AS present_sessions,
        SUM(CASE WHEN es.status = 'absent' THEN 1 ELSE 0 END) AS absent_sessions,
        SUM(CASE WHEN es.status = 'excused' THEN 1 ELSE 0 END) AS excused_sessions,
        SUM(CASE WHEN es.status = 'pending' THEN 1 ELSE 0 END) AS pending_sessions,
        SUM(CASE
          WHEN es.status IN ('present', 'absent')
           AND et.billing_type = 'session_based'
           AND et.tuition_amount IS NOT NULL
           AND et.planned_sessions IS NOT NULL
           AND et.planned_sessions > 0
          THEN CAST(et.tuition_amount AS REAL) / et.planned_sessions
          ELSE 0
        END) AS session_value_total
      FROM class_sessions cs
      JOIN enrollment_sessions es ON es.session_id = cs.id
      JOIN enrollments e ON e.id = es.enrollment_id
      LEFT JOIN enrollment_terms et ON et.id = es.enrollment_term_id
      WHERE cs.session_date >= ?
        AND cs.session_date < ?
        AND cs.status <> 'cancelled'
        AND e.class_id = cs.class_id
      GROUP BY cs.instructor_id
    `).bind(startDate, endDate).all<{
      instructor_id: number; class_sessions: number; student_sessions: number;
      present_sessions: number; absent_sessions: number; excused_sessions: number;
      pending_sessions: number; session_value_total: number;
    }>();

    const byInstructor = new Map(workRows.results.map((row) => [row.instructor_id, row]));
    const instructors = instructorRows.results.map((row) => {
      const work = byInstructor.get(row.id);
      const percentage = Math.min(100, Math.max(0, Number(row.pay_percentage ?? 50)));
      const presentSessions = Number(work?.present_sessions ?? 0);
      const absentSessions = Number(work?.absent_sessions ?? 0);
      const sessionValueTotal = Number(work?.session_value_total ?? 0);
      const instructorShare = sessionValueTotal * (percentage / 100);
      return {
        instructorId: row.id,
        instructorName: `${row.first_name} ${row.last_name}`.trim(),
        payPercentage: percentage,
        classSessions: Number(work?.class_sessions ?? 0),
        studentSessions: Number(work?.student_sessions ?? 0),
        presentSessions,
        absentSessions,
        excusedSessions: Number(work?.excused_sessions ?? 0),
        pendingSessions: Number(work?.pending_sessions ?? 0),
        compensableSessions: presentSessions + absentSessions,
        sessionValueTotal,
        instructorShare,
        hasSessionBasedAmount: sessionValueTotal > 0,
      };
    });

    return json({
      success: true,
      month,
      startDate,
      endDate,
      instructors,
      totals: {
        classSessions: instructors.reduce((sum, row) => sum + row.classSessions, 0),
        studentSessions: instructors.reduce((sum, row) => sum + row.studentSessions, 0),
        compensableSessions: instructors.reduce((sum, row) => sum + row.compensableSessions, 0),
        absentSessions: instructors.reduce((sum, row) => sum + row.absentSessions, 0),
        instructorShare: instructors.reduce((sum, row) => sum + row.instructorShare, 0),
      },
    });
  } catch (error) {
    console.error("[admin/teacher-workload] request failed:", error);
    return json({ success: false, message: "محاسبه کارکرد اساتید با خطا مواجه شد." }, 500);
  }
};
