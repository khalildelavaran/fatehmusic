import { provisionEnrollmentSessionsForClassSession } from './session-provisioning';

/**
 * Backward-compatible facade. The canonical implementation lives in
 * session-provisioning.ts so there is only one provisioning algorithm and one
 * source for class term policy (class_term_settings).
 */
export async function initializeSessionEnrollments(
  db: D1Database,
  sessionId: number,
): Promise<number> {
  const result = await provisionEnrollmentSessionsForClassSession(db, sessionId);
  return result.enrollmentSessionIds.length;
}
