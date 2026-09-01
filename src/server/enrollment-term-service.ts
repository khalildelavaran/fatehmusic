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
  if (!Number.isInteger(input.enrollmentId) || input.enrollmentId <= 0) throw new Error('INVALID_ENROLLMENT');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error('INVALID_START_DATE');

  const enrollment = await db.prepare(`
    SELECT id FROM enrollments WHERE id = ? AND status = 'active'
  `).bind(input.enrollmentId).first<{ id: number }>();
  if (!enrollment) throw new Error('ACTIVE_ENROLLMENT_NOT_FOUND');

  const billingType = input.billingType ?? 'session_based';
  if (billingType === 'session_based' && (!Number.isInteger(input.plannedSessions) || (input.plannedSessions ?? 0) <= 0)) {
    throw new Error('INVALID_PLANNED_SESSIONS');
  }

  const existing = await db.prepare(`
    SELECT id FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    ORDER BY term_number DESC, id DESC LIMIT 1
  `).bind(input.enrollmentId).first<{ id: number }>();
  if (existing) return existing.id;

  const next = await db.prepare(`
    SELECT COALESCE(MAX(term_number), 0) + 1 AS next_number
    FROM enrollment_terms WHERE enrollment_id = ?
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
    billingType === 'monthly' ? null : input.plannedSessions,
    billingType,
    input.tuitionAmount ?? null,
    input.tuitionDueDate ?? null,
  ).first<{ id: number }>();

  if (!result) throw new Error('TERM_CREATE_FAILED');
  return result.id;
}

/** The first concrete class session determines the term start date. */
export async function ensureTermForFirstSession(
  db: D1Database,
  enrollmentId: number,
  sessionDate: string,
  options: Omit<EnrollmentTermInput, 'enrollmentId' | 'startDate'> = {},
): Promise<number> {
  const existing = await db.prepare(`
    SELECT id FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    ORDER BY term_number DESC, id DESC LIMIT 1
  `).bind(enrollmentId).first<{ id: number }>();
  if (existing) return existing.id;
  return ensureActiveEnrollmentTerm(db, { enrollmentId, startDate: sessionDate, ...options });
}
