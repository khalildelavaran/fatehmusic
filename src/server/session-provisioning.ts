import { ensureTermForFirstSession } from './enrollment-term-service';
import { getClassTermSettings } from './class-term-settings';

export type ProvisionSessionResult = {
  sessionId: number;
  enrollmentSessionIds: number[];
};

function addDays(date: string, days: number | null): string | null {
  if (days == null) return null;
  const base = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) throw new Error('INVALID_SESSION_DATE');
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/**
 * Creates one pending EnrollmentSession for every active Enrollment attached
 * to a concrete ClassSession. Re-running the function is idempotent.
 *
 * The first concrete session starts the student's active term. Class term
 * settings are copied into that term as a snapshot so later policy changes do
 * not rewrite historical terms.
 */
export async function provisionEnrollmentSessionsForClassSession(
  db: D1Database,
  sessionId: number,
): Promise<ProvisionSessionResult> {
  const session = await db.prepare(`
    SELECT id, class_id, session_date, status
    FROM class_sessions
    WHERE id = ?
  `).bind(sessionId).first<{
    id: number;
    class_id: number;
    session_date: string;
    status: 'scheduled' | 'completed' | 'cancelled';
  }>();

  if (!session) throw new Error('SESSION_NOT_FOUND');
  if (session.status === 'cancelled') {
    return { sessionId, enrollmentSessionIds: [] };
  }

  const settings = await getClassTermSettings(db, session.class_id);
  const enrollments = await db.prepare(`
    SELECT id
    FROM enrollments
    WHERE class_id = ? AND status = 'active'
    ORDER BY id
  `).bind(session.class_id).all<{ id: number }>();

  const ids: number[] = [];

  for (const enrollment of enrollments.results) {
    const termId = await ensureTermForFirstSession(
      db,
      enrollment.id,
      session.session_date,
      settings ? {
        billingType: settings.billingType,
        plannedSessions: settings.plannedSessions,
        tuitionAmount: settings.tuitionAmount,
        tuitionDueDate: addDays(session.session_date, settings.tuitionDueDays),
      } : {},
    );

    await db.prepare(`
      INSERT INTO enrollment_sessions
        (enrollment_id, session_id, enrollment_term_id, status)
      VALUES (?, ?, ?, 'pending')
      ON CONFLICT(enrollment_id, session_id) DO UPDATE SET
        enrollment_term_id = COALESCE(enrollment_sessions.enrollment_term_id, excluded.enrollment_term_id),
        updated_at = datetime('now')
    `).bind(enrollment.id, sessionId, termId).run();

    const row = await db.prepare(`
      SELECT id
      FROM enrollment_sessions
      WHERE enrollment_id = ? AND session_id = ?
    `).bind(enrollment.id, sessionId).first<{ id: number }>();

    if (row) ids.push(row.id);
  }

  return { sessionId, enrollmentSessionIds: ids };
}
