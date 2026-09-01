export type BillingType = 'session_based' | 'monthly';

export type EnrollmentTermInput = {
  enrollmentId: number;
  startDate: string;
  plannedSessions?: number | null;
  billingType?: BillingType;
  tuitionAmount?: number | null;
  tuitionDueDate?: string | null;
};

export async function ensureActiveEnrollmentTerm(
  db: D1Database,
  input: EnrollmentTermInput,
): Promise<number> {
  const existing = await db.prepare(`
    SELECT id
    FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    ORDER BY term_number DESC, id DESC
    LIMIT 1
  `).bind(input.enrollmentId).first<{ id: number }>();

  if (existing) return existing.id;

  const next = await db.prepare(`
    SELECT COALESCE(MAX(term_number), 0) + 1 AS next_number
    FROM enrollment_terms
    WHERE enrollment_id = ?
  `).bind(input.enrollmentId).first<{ next_number: number }>();

  const result = await db.prepare(`
    INSERT INTO enrollment_terms
      (enrollment_id, term_number, start_date, planned_sessions, billing_type,
       tuition_amount, tuition_due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    RETURNING id
  `).bind(
    input.enrollmentId,
    next?.next_number ?? 1,
    input.startDate,
    input.plannedSessions ?? null,
    input.billingType ?? 'session_based',
    input.tuitionAmount ?? null,
    input.tuitionDueDate ?? null,
  ).first<{ id: number }>();

  if (!result) throw new Error('TERM_CREATE_FAILED');
  return result.id;
}

/**
 * When the first real session of an enrollment is encountered, the term
 * starts on that concrete session date rather than on registration date.
 */
export async function ensureTermForFirstSession(
  db: D1Database,
  enrollmentId: number,
  sessionDate: string,
): Promise<number> {
  const existing = await db.prepare(`
    SELECT id FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    LIMIT 1
  `).bind(enrollmentId).first<{ id: number }>();

  if (existing) return existing.id;

  return ensureActiveEnrollmentTerm(db, {
    enrollmentId,
    startDate: sessionDate,
    billingType: 'session_based',
  });
}
