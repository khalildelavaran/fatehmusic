export type EnrollmentProgress = {
  termId: number;
  billingType: 'session_based' | 'monthly';
  plannedSessions: number | null;
  consumedSessions: number;
  remainingSessions: number | null;
  pendingSessions: number;
  excusedSessions: number;
};

type TermRow = {
  id: number;
  billing_type: 'session_based' | 'monthly';
  planned_sessions: number | null;
};

export async function getEnrollmentProgress(
  db: D1Database,
  enrollmentId: number,
): Promise<EnrollmentProgress | null> {
  const term = await db.prepare(`
    SELECT id, billing_type, planned_sessions
    FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    ORDER BY term_number DESC, id DESC
    LIMIT 1
  `).bind(enrollmentId).first<TermRow>();

  if (!term) return null;

  const counts = await db.prepare(`
    SELECT
      SUM(CASE WHEN status IN ('present', 'absent') THEN 1 ELSE 0 END) AS consumed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) AS excused
    FROM enrollment_sessions
    WHERE enrollment_id = ? AND enrollment_term_id = ?
  `).bind(enrollmentId, term.id).first<{
    consumed: number | null;
    pending: number | null;
    excused: number | null;
  }>();

  const consumedSessions = counts?.consumed ?? 0;
  const pendingSessions = counts?.pending ?? 0;
  const excusedSessions = counts?.excused ?? 0;

  return {
    termId: term.id,
    billingType: term.billing_type,
    plannedSessions: term.planned_sessions,
    consumedSessions,
    remainingSessions:
      term.billing_type === 'monthly' || term.planned_sessions == null
        ? null
        : Math.max(term.planned_sessions - consumedSessions, 0),
    pendingSessions,
    excusedSessions,
  };
}

export function shouldWarnForRenewal(progress: EnrollmentProgress): boolean {
  if (progress.billingType === 'monthly' || progress.plannedSessions == null) return false;
  return progress.remainingSessions <= 1;
}
