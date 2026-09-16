export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, requireRole, ROLES } from "../../../server/admin-auth";

const clean = (value: unknown) => String(value ?? "").trim();

export const GET: APIRoute = async ({ request }) => {
  const denied = await requireRole(request, env, [ROLES.ADMIN, ROLES.REGISTRAR]);
  if (denied) return denied;
  const db = env.DB;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ success: false, message: "تاریخ معتبر نیست." }, 422);
  const q = clean(url.searchParams.get("q"));

  try {
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      const result = await db.prepare(`
        SELECT * FROM (
          SELECT 'student' AS result_type, s.id,
            TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')) AS name,
            e.id AS enrollment_id, e.class_id, c.title AS class_title, NULL AS instructor_name,
            NULL AS session_date, NULL AS start_time, NULL AS end_time,
            COALESCE((SELECT GROUP_CONCAT(DISTINCT cs.id) FROM class_sessions cs
              JOIN enrollment_sessions es ON es.session_id = cs.id
              WHERE es.enrollment_id = e.id AND cs.session_date = ? AND cs.status <> 'cancelled'), '') AS session_ids
          FROM students s
          JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
          JOIN classes c ON c.id = e.class_id
          WHERE (s.first_name || ' ' || s.last_name) LIKE ? ESCAPE '\\'
          UNION ALL
          SELECT 'instructor', i.id,
            TRIM(COALESCE(i.first_name,'') || ' ' || COALESCE(i.last_name,'')),
            NULL, NULL, NULL,
            TRIM(COALESCE(i.first_name,'') || ' ' || COALESCE(i.last_name,'')),
            NULL, NULL, NULL,
            COALESCE((SELECT GROUP_CONCAT(cs.id) FROM class_sessions cs
              WHERE cs.instructor_id = i.id AND cs.session_date = ? AND cs.status <> 'cancelled'), '')
          FROM instructors i
          WHERE (i.first_name || ' ' || i.last_name) LIKE ? ESCAPE '\\'
          UNION ALL
          SELECT 'class', c.id, c.title, NULL, c.id, c.title, NULL,
            cs.session_date, cs.start_time, cs.end_time,
            COALESCE((SELECT GROUP_CONCAT(cs2.id) FROM class_sessions cs2
              WHERE cs2.class_id = c.id AND cs2.session_date = ? AND cs2.status <> 'cancelled'), '')
          FROM classes c
          LEFT JOIN class_sessions cs ON cs.class_id = c.id AND cs.session_date = ?
          WHERE c.title LIKE ? ESCAPE '\\'
        )
        ORDER BY CASE result_type WHEN 'student' THEN 1 WHEN 'instructor' THEN 2 ELSE 3 END, name LIMIT 20
      `).bind(date, like, date, like, date, date, like).all();
      return json({ success: true, date, query: q, results: result.results });
    }

    const metrics = await db.prepare(`
      WITH daily AS (
        SELECT id, status, room_id FROM class_sessions WHERE session_date = ?
      ), attendance AS (
        SELECT es.status FROM enrollment_sessions es JOIN daily d ON d.id = es.session_id
        WHERE d.status <> 'cancelled'
      ), financial AS (
        SELECT et.id AS term_id, et.billing_type, et.planned_sessions, et.tuition_due_date,
          i.id AS invoice_id, i.amount AS invoice_amount,
          COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
        FROM enrollment_terms et JOIN enrollments e ON e.id = et.enrollment_id AND e.status = 'active'
        LEFT JOIN invoices i ON i.enrollment_term_id = et.id AND i.status <> 'cancelled'
          AND i.id = (SELECT MAX(i2.id) FROM invoices i2 WHERE i2.enrollment_term_id = et.id AND i2.status <> 'cancelled')
        WHERE et.status = 'active'
      )
      SELECT
        (SELECT COUNT(*) FROM daily WHERE status <> 'cancelled') AS active_sessions,
        (SELECT COUNT(*) FROM daily WHERE status = 'cancelled') AS cancelled_sessions,
        (SELECT COUNT(*) FROM attendance WHERE status = 'pending') AS pending_attendance,
        (SELECT COUNT(*) FROM daily WHERE room_id IS NULL AND status <> 'cancelled') AS no_room_sessions,
        (SELECT COUNT(*) FROM financial WHERE invoice_id IS NOT NULL AND (invoice_amount - paid_amount) > 0) AS outstanding_terms,
        (SELECT COUNT(*) FROM financial WHERE invoice_id IS NOT NULL AND tuition_due_date IS NOT NULL AND tuition_due_date < ? AND (invoice_amount - paid_amount) > 0) AS overdue_terms
    `).bind(date, date).first<Record<string, number>>();

    const renewal = await db.prepare(`
      SELECT COUNT(*) AS count FROM enrollment_terms et
      JOIN enrollments e ON e.id = et.enrollment_id AND e.status = 'active'
      WHERE et.status = 'active' AND (
        et.billing_type = 'monthly'
        OR (et.planned_sessions IS NOT NULL AND et.planned_sessions - (
          SELECT COUNT(*) FROM enrollment_sessions es
          WHERE es.enrollment_term_id = et.id AND es.status IN ('present','absent')
        ) <= 1)
      )
    `).first<{ count: number }>();

    const payments = await db.prepare(`
      SELECT COALESCE(SUM(p.amount),0) AS amount, COUNT(*) AS count
      FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE DATE(p.created_at) = ?
    `).bind(date).first<{ amount: number; count: number }>();

    const instructors = await db.prepare(`
      SELECT cs.instructor_id,
        TRIM(COALESCE(i.first_name,'') || ' ' || COALESCE(i.last_name,'')) AS instructor_name,
        COUNT(*) AS session_count,
        SUM(CASE WHEN COALESCE(tsa.status,'pending')='present' THEN 1 ELSE 0 END) AS teacher_present,
        SUM(CASE WHEN COALESCE(tsa.status,'pending')='absent' THEN 1 ELSE 0 END) AS teacher_absent,
        SUM(CASE WHEN COALESCE(tsa.status,'pending')='pending' THEN 1 ELSE 0 END) AS teacher_pending,
        MIN(cs.start_time) AS first_session, MAX(cs.end_time) AS last_session
      FROM class_sessions cs
      LEFT JOIN instructors i ON i.id = cs.instructor_id
      LEFT JOIN teacher_session_attendance tsa ON tsa.session_id = cs.id AND tsa.instructor_id = cs.instructor_id
      WHERE cs.session_date = ? AND cs.status <> 'cancelled'
      GROUP BY cs.instructor_id, instructor_name ORDER BY first_session
    `).bind(date).all();

    const instructorConflicts = await db.prepare(`
      SELECT DISTINCT cs.id
      FROM class_sessions cs
      JOIN class_sessions other ON other.session_date = cs.session_date
        AND other.id <> cs.id AND other.status <> 'cancelled' AND cs.status <> 'cancelled'
        AND other.instructor_id = cs.instructor_id
        AND other.start_time < cs.end_time AND other.end_time > cs.start_time
      WHERE cs.session_date = ?
    `).bind(date).all<{ id: string }>();

    const roomConflicts = await db.prepare(`
      SELECT DISTINCT cs.id
      FROM class_sessions cs
      JOIN class_sessions other ON other.session_date = cs.session_date
        AND other.id <> cs.id AND other.status <> 'cancelled' AND cs.status <> 'cancelled'
        AND cs.room_id IS NOT NULL AND other.room_id = cs.room_id
        AND other.start_time < cs.end_time AND other.end_time > cs.start_time
      WHERE cs.session_date = ?
    `).bind(date).all<{ id: string }>();

    const financialTargets = await db.prepare(`
      SELECT
        COALESCE(GROUP_CONCAT(DISTINCT CASE WHEN i.id IS NOT NULL AND (i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0)) > 0 THEN cs.id END), '') AS outstanding_session_ids,
        COALESCE(GROUP_CONCAT(DISTINCT CASE WHEN i.id IS NOT NULL AND i.due_date IS NOT NULL AND i.due_date < ? AND (i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0)) > 0 THEN cs.id END), '') AS overdue_session_ids,
        COALESCE(GROUP_CONCAT(DISTINCT CASE WHEN et.billing_type = 'monthly' OR (et.planned_sessions IS NOT NULL AND et.planned_sessions - (SELECT COUNT(*) FROM enrollment_sessions consumed WHERE consumed.enrollment_term_id=et.id AND consumed.status IN ('present','absent')) <= 1) THEN cs.id END), '') AS renewal_session_ids
      FROM class_sessions cs
      JOIN enrollment_sessions es ON es.session_id = cs.id
      JOIN enrollment_terms et ON et.id = es.enrollment_term_id AND et.status = 'active'
      LEFT JOIN invoices i ON i.enrollment_term_id = et.id AND i.status <> 'cancelled'
        AND i.id = (SELECT MAX(i2.id) FROM invoices i2 WHERE i2.enrollment_term_id=et.id AND i2.status <> 'cancelled')
      WHERE cs.session_date = ? AND cs.status <> 'cancelled'
    `).bind(date, date).first<{ outstanding_session_ids: string; overdue_session_ids: string; renewal_session_ids: string }>();

    const instructorConflictIds = instructorConflicts.results.map((row) => String(row.id));
    const roomConflictIds = roomConflicts.results.map((row) => String(row.id));
    const csv = (value: string | null | undefined) => String(value ?? '').split(',').map(v => v.trim()).filter(Boolean);

    return json({
      success: true, date,
      metrics: {
        ...(metrics ?? {}),
        renewalCandidates: Number(renewal?.count ?? 0),
        paymentsToday: Number(payments?.amount ?? 0),
        paymentCountToday: Number(payments?.count ?? 0),
        instructor_conflicts: instructorConflictIds.length,
        room_conflicts: roomConflictIds.length,
      },
      instructor_conflict_session_ids: instructorConflictIds,
      room_conflict_session_ids: roomConflictIds,
      outstanding_session_ids: csv(financialTargets?.outstanding_session_ids),
      overdue_session_ids: csv(financialTargets?.overdue_session_ids),
      renewal_session_ids: csv(financialTargets?.renewal_session_ids),
      instructors: instructors.results,
    });
  } catch (error) {
    console.error('[admin/daily-command-center] failed:', error);
    return json({ success: false, message: error instanceof Error ? error.message : 'خطا در دریافت اطلاعات مرکز عملیات.' }, 500);
  }
};
