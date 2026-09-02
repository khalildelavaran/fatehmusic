import { ensureTermForFirstSession } from './enrollment-term-service';
import { getClassTermSettings } from './class-term-settings';
import { ensureNormalizedEnrollment } from './enrollment-service';

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
 * Legacy class_students rows are normalized into enrollments on demand so
 * existing Class Management data remains visible to the operational domain.
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

  // Bridge legacy Class Management memberships into the operational
  // Enrollment model before creating per-session attendance rows.
  const legacyStudents = await db.prepare(`
    SELECT student_id
    FROM class_students
    WHERE class_id = ? AND status = 'active'
    ORDER BY student_id
  `).bind(session.class_id).all<{ student_id: number }>();

  for (const row of legacyStudents.results) {
    try {
      await ensureNormalizedEnrollment(db, session.class_id, row.student_id);
    } catch (error) {
      console.error(
        `[session-provisioning] enrollment normalization failed for class ${session.class_id}, student ${row.student_id}:`,
        error,
      );
    }
  }

  let settings: Awaited<ReturnType<typeof getClassTermSettings>> = null;
  try {
    settings = await getClassTermSettings(db, session.class_id);
  } catch (error) {
    console.warn(`[session-provisioning] class term settings unavailable for class ${session.class_id}; using defaults:`, error);
  }

  const enrollments = await db.prepare(`
    SELECT id
    FROM enrollments
    WHERE class_id = ? AND status = 'active'
    ORDER BY id
  `).bind(session.class_id).all<{ id: number }>();

  const ids: number[] = [];

  for (const enrollment of enrollments.results) {
    try {
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
    } catch (error) {
      console.error(`[session-provisioning] failed for enrollment ${enrollment.id}, session ${sessionId}:`, error);
    }
  }

  return { sessionId, enrollmentSessionIds: ids };
}
