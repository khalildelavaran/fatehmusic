import { ensureFirstEnrollmentTerm } from "./enrollments";

/**
 * Attaches all active class enrollments to a concrete session.
 * The first concrete session creates the student's first term lazily.
 * This function is idempotent and safe to call after session creation.
 */
export async function initializeSessionEnrollments(db: D1Database, sessionId: number): Promise<number> {
  const session = await db.prepare(`
    SELECT cs.id, cs.class_id, cs.session_date, c.default_term_sessions, c.default_billing_type
    FROM class_sessions cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.id = ?
  `).bind(sessionId).first<{
    id: number;
    class_id: number;
    session_date: string;
    default_term_sessions: number | null;
    default_billing_type: string;
  }>();

  if (!session) throw new Error("جلسه یافت نشد.");

  const enrollments = await db.prepare(`
    SELECT id
    FROM enrollments
    WHERE class_id = ? AND status = 'active'
    ORDER BY id
  `).bind(session.class_id).all<{ id: number }>();

  let created = 0;
  for (const enrollment of enrollments.results) {
    const termId = await ensureFirstEnrollmentTerm(db, enrollment.id, session.session_date, {
      plannedSessions: session.default_term_sessions,
      billingType: session.default_billing_type === "monthly" ? "monthly" : "session_based"
    });

    const result = await db.prepare(`
      INSERT INTO enrollment_sessions (enrollment_id, session_id, enrollment_term_id, status)
      VALUES (?, ?, ?, 'absent')
      ON CONFLICT(enrollment_id, session_id) DO UPDATE SET
        enrollment_term_id = COALESCE(enrollment_sessions.enrollment_term_id, excluded.enrollment_term_id),
        updated_at = datetime('now')
    `).bind(enrollment.id, sessionId, termId).run();

    if (result.success) created += 1;
  }

  return created;
}
