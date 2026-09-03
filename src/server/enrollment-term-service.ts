import { getClassTermSettings } from './class-term-settings';

export type BillingType = 'session_based' | 'monthly';

export type EnrollmentTermInput = {
  enrollmentId: number;
  startDate: string;
  plannedSessions?: number | null;
  billingType?: BillingType;
  tuitionAmount?: number | null;
  tuitionDueDate?: string | null;
};

type ExistingTermRow = {
  id: number;
  tuition_amount: number | null;
  tuition_due_date: string | null;
};

async function ensureTuitionInvoice(
  db: D1Database,
  termId: number,
  amount: number | null,
  dueDate: string | null,
): Promise<void> {
  if (amount == null) return;

  await db.prepare(`
    INSERT INTO invoices (enrollment_term_id, amount, due_date, status, description)
    SELECT ?, ?, ?, 'pending', 'شهریه ترم'
    WHERE NOT EXISTS (
      SELECT 1 FROM invoices WHERE enrollment_term_id = ? AND status <> 'cancelled'
    )
  `).bind(termId, amount, dueDate, termId).run();
}

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
  if (billingType !== 'session_based' && billingType !== 'monthly') throw new Error('INVALID_BILLING_TYPE');
  if (input.plannedSessions !== null && input.plannedSessions !== undefined &&
      (!Number.isInteger(input.plannedSessions) || input.plannedSessions <= 0)) {
    throw new Error('INVALID_PLANNED_SESSIONS');
  }
  if (billingType === 'monthly' && input.plannedSessions != null) throw new Error('MONTHLY_CANNOT_HAVE_PLANNED_SESSIONS');
  if (input.tuitionAmount != null && (!Number.isInteger(input.tuitionAmount) || input.tuitionAmount < 0)) {
    throw new Error('INVALID_TUITION_AMOUNT');
  }
  if (input.tuitionDueDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(input.tuitionDueDate)) {
    throw new Error('INVALID_TUITION_DUE_DATE');
  }

  const existing = await db.prepare(`
    SELECT id, tuition_amount, tuition_due_date
    FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    ORDER BY term_number DESC, id DESC
    LIMIT 1
  `).bind(input.enrollmentId).first<ExistingTermRow>();

  if (existing) {
    await ensureTuitionInvoice(db, existing.id, existing.tuition_amount, existing.tuition_due_date);
    return existing.id;
  }

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
    billingType === 'monthly' ? null : (input.plannedSessions ?? null),
    billingType,
    input.tuitionAmount ?? null,
    input.tuitionDueDate ?? null,
  ).first<{ id: number }>();

  if (!result) throw new Error('TERM_CREATE_FAILED');

  await ensureTuitionInvoice(
    db,
    result.id,
    input.tuitionAmount ?? null,
    input.tuitionDueDate ?? null,
  );

  return result.id;
}

/**
 * Explicitly closes the current term and opens the next term.
 * The new term snapshots the current class billing settings at renewal time.
 * Existing invoices/payments remain attached to the previous term.
 */
export async function renewEnrollmentTerm(
  db: D1Database,
  enrollmentId: number,
  startDate: string,
): Promise<{
  previousTermId: number;
  termId: number;
  termNumber: number;
  billingType: BillingType;
  plannedSessions: number | null;
  tuitionAmount: number | null;
  tuitionDueDate: string | null;
  invoiceId: number | null;
}> {
  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) throw new Error('INVALID_ENROLLMENT');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error('INVALID_START_DATE');

  const enrollment = await db.prepare(`
    SELECT id, class_id
    FROM enrollments
    WHERE id = ? AND status = 'active'
  `).bind(enrollmentId).first<{ id: number; class_id: number }>();
  if (!enrollment) throw new Error('ACTIVE_ENROLLMENT_NOT_FOUND');

  const current = await db.prepare(`
    SELECT id, term_number, billing_type, planned_sessions
    FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    ORDER BY term_number DESC, id DESC
    LIMIT 1
  `).bind(enrollmentId).first<{
    id: number;
    term_number: number;
    billing_type: BillingType;
    planned_sessions: number | null;
  }>();
  if (!current) throw new Error('ACTIVE_TERM_NOT_FOUND');

  if (current.billing_type === 'session_based' && current.planned_sessions != null) {
    const counts = await db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN status IN ('present', 'absent') THEN 1 ELSE 0 END), 0) AS consumed
      FROM enrollment_sessions
      WHERE enrollment_id = ? AND enrollment_term_id = ?
    `).bind(enrollmentId, current.id).first<{ consumed: number }>();
    const remaining = Math.max(current.planned_sessions - (counts?.consumed ?? 0), 0);
    if (remaining > 1) throw new Error('TERM_NOT_READY_FOR_RENEWAL');
  }

  const settings = await getClassTermSettings(db, enrollment.class_id);
  if (!settings) throw new Error('CLASS_TERM_SETTINGS_NOT_FOUND');

  const dueDate = settings.tuitionDueDays == null
    ? null
    : (() => {
        const date = new Date(`${startDate}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + settings.tuitionDueDays!);
        return date.toISOString().slice(0, 10);
      })();

  await db.prepare(`
    UPDATE enrollment_terms
    SET status = 'completed', updated_at = datetime('now')
    WHERE id = ? AND status = 'active'
  `).bind(current.id).run();

  const nextNumber = current.term_number + 1;
  const nextTerm = await db.prepare(`
    INSERT INTO enrollment_terms
      (enrollment_id, term_number, start_date, planned_sessions, billing_type,
       tuition_amount, tuition_due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    RETURNING id
  `).bind(
    enrollmentId,
    nextNumber,
    startDate,
    settings.plannedSessions,
    settings.billingType,
    settings.tuitionAmount,
    dueDate,
  ).first<{ id: number }>();

  if (!nextTerm) throw new Error('TERM_RENEWAL_CREATE_FAILED');

  await ensureTuitionInvoice(db, nextTerm.id, settings.tuitionAmount, dueDate);
  const invoice = await db.prepare(`
    SELECT id FROM invoices
    WHERE enrollment_term_id = ? AND status <> 'cancelled'
    ORDER BY id DESC LIMIT 1
  `).bind(nextTerm.id).first<{ id: number }>();

  return {
    previousTermId: current.id,
    termId: nextTerm.id,
    termNumber: nextNumber,
    billingType: settings.billingType,
    plannedSessions: settings.plannedSessions,
    tuitionAmount: settings.tuitionAmount,
    tuitionDueDate: dueDate,
    invoiceId: invoice?.id ?? null,
  };
}

/** The first concrete class session determines the term start date. */
export async function ensureTermForFirstSession(
  db: D1Database,
  enrollmentId: number,
  sessionDate: string,
  options: Omit<EnrollmentTermInput, 'enrollmentId' | 'startDate'> = {},
): Promise<number> {
  return ensureActiveEnrollmentTerm(db, {
    enrollmentId,
    startDate: sessionDate,
    ...options,
  });
}
