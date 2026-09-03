export type BillingType = 'session_based' | 'monthly';

export type EnrollmentTermInput = {
  enrollmentId: number;
  startDate: string;
  plannedSessions?: number | null;
  billingType?: BillingType;
  tuitionAmount?: number | null;
  tuitionDueDate?: string | null;
};

type ClassSettings = {
  billing_type: BillingType;
  planned_sessions: number | null;
  tuition_amount: number | null;
  tuition_due_days: number | null;
};

type ExistingTermRow = {
  id: number;
  tuition_amount: number | null;
  tuition_due_date: string | null;
};

type RenewableTermRow = ExistingTermRow & {
  enrollment_id: number;
  start_date: string;
  planned_sessions: number | null;
  billing_type: BillingType;
};

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) throw new Error('INVALID_START_DATE');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validateTermOptions(input: EnrollmentTermInput) {
  if (!Number.isInteger(input.enrollmentId) || input.enrollmentId <= 0) throw new Error('INVALID_ENROLLMENT');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error('INVALID_START_DATE');

  const billingType = input.billingType ?? 'session_based';
  if (billingType !== 'session_based' && billingType !== 'monthly') throw new Error('INVALID_BILLING_TYPE');
  if (input.plannedSessions != null && (!Number.isInteger(input.plannedSessions) || input.plannedSessions <= 0)) {
    throw new Error('INVALID_PLANNED_SESSIONS');
  }
  if (billingType === 'monthly' && input.plannedSessions != null) {
    throw new Error('MONTHLY_CANNOT_HAVE_PLANNED_SESSIONS');
  }
  if (input.tuitionAmount != null && (!Number.isInteger(input.tuitionAmount) || input.tuitionAmount < 0)) {
    throw new Error('INVALID_TUITION_AMOUNT');
  }
  if (input.tuitionDueDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(input.tuitionDueDate)) {
    throw new Error('INVALID_TUITION_DUE_DATE');
  }

  return billingType;
}

export async function getActiveClassTermSettings(db: D1Database, classId: number): Promise<ClassSettings | null> {
  return db.prepare(`
    SELECT billing_type, planned_sessions, tuition_amount, tuition_due_days
    FROM class_term_settings
    WHERE class_id = ?
    LIMIT 1
  `).bind(classId).first<ClassSettings>();
}

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
  validateTermOptions(input);

  const enrollment = await db.prepare(`
    SELECT id, class_id FROM enrollments WHERE id = ? AND status = 'active'
  `).bind(input.enrollmentId).first<{ id: number; class_id: number }>();
  if (!enrollment) throw new Error('ACTIVE_ENROLLMENT_NOT_FOUND');

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

  const settings = await getActiveClassTermSettings(db, enrollment.class_id);
  const billingType = input.billingType ?? settings?.billing_type ?? 'session_based';
  const plannedSessions = input.plannedSessions !== undefined
    ? input.plannedSessions
    : (billingType === 'monthly' ? null : (settings?.planned_sessions ?? null));
  const tuitionAmount = input.tuitionAmount !== undefined
    ? input.tuitionAmount
    : (settings?.tuition_amount ?? null);
  const tuitionDueDate = input.tuitionDueDate !== undefined
    ? input.tuitionDueDate
    : (settings?.tuition_due_days != null ? addDays(input.startDate, settings.tuition_due_days) : null);

  if (billingType === 'session_based' && plannedSessions == null) {
    throw new Error('SESSION_BASED_REQUIRES_PLANNED_SESSIONS');
  }
  if (billingType === 'monthly' && plannedSessions != null) {
    throw new Error('MONTHLY_CANNOT_HAVE_PLANNED_SESSIONS');
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
    plannedSessions,
    billingType,
    tuitionAmount,
    tuitionDueDate,
  ).first<{ id: number }>();

  if (!result) throw new Error('TERM_CREATE_FAILED');

  await ensureTuitionInvoice(db, result.id, tuitionAmount, tuitionDueDate);
  return result.id;
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

/**
 * Completes an exhausted term and opens the next term using a fresh snapshot
 * of the class-level settings. Pending occurrences from the new start date
 * onward are rebound to the new term; consumed history remains immutable.
 */
export async function renewEnrollmentTerm(
  db: D1Database,
  enrollmentId: number,
  startDate: string,
): Promise<{ previousTermId: number; termId: number }> {
  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) throw new Error('INVALID_ENROLLMENT');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error('INVALID_START_DATE');

  const enrollment = await db.prepare(`
    SELECT id, class_id FROM enrollments WHERE id = ? AND status = 'active'
  `).bind(enrollmentId).first<{ id:number; class_id:number }>();
  if (!enrollment) throw new Error('ACTIVE_ENROLLMENT_NOT_FOUND');

  const active = await db.prepare(`
    SELECT id, enrollment_id, start_date, planned_sessions, billing_type,
           tuition_amount, tuition_due_date
    FROM enrollment_terms
    WHERE enrollment_id = ? AND status = 'active'
    ORDER BY term_number DESC, id DESC
    LIMIT 1
  `).bind(enrollmentId).first<RenewableTermRow>();
  if (!active) throw new Error('ACTIVE_TERM_NOT_FOUND');
  if (startDate < active.start_date) throw new Error('RENEWAL_DATE_BEFORE_ACTIVE_TERM');

  if (active.billing_type === 'session_based') {
    if (active.planned_sessions == null) throw new Error('ACTIVE_TERM_PLAN_MISSING');
    const count = await db.prepare(`
      SELECT COUNT(*) AS consumed
      FROM enrollment_sessions es
      JOIN class_sessions cs ON cs.id = es.session_id
      WHERE es.enrollment_id = ?
        AND es.enrollment_term_id = ?
        AND es.status IN ('present', 'absent')
        AND cs.status <> 'cancelled'
    `).bind(enrollmentId, active.id).first<{ consumed:number }>();
    if ((count?.consumed ?? 0) < active.planned_sessions) throw new Error('TERM_NOT_EXHAUSTED');
  } else {
    if (startDate.slice(0, 7) <= active.start_date.slice(0, 7)) throw new Error('MONTHLY_TERM_NOT_READY');
  }

  await db.prepare(`
    UPDATE enrollment_terms
    SET status = 'completed', updated_at = datetime('now')
    WHERE id = ? AND status = 'active'
  `).bind(active.id).run();

  let newTermId: number;
  try {
    newTermId = await ensureActiveEnrollmentTerm(db, { enrollmentId, startDate });
  } catch (error) {
    await db.prepare(`
      UPDATE enrollment_terms SET status = 'active', updated_at = datetime('now')
      WHERE id = ? AND NOT EXISTS (
        SELECT 1 FROM enrollment_terms WHERE enrollment_id = ? AND status = 'active'
      )
    `).bind(active.id, enrollmentId).run();
    throw error;
  }

  await db.prepare(`
    UPDATE enrollment_sessions
    SET enrollment_term_id = ?, updated_at = datetime('now')
    WHERE enrollment_id = ?
      AND enrollment_term_id = ?
      AND status = 'pending'
      AND session_id IN (
        SELECT id FROM class_sessions WHERE session_date >= ?
      )
  `).bind(newTermId, enrollmentId, active.id, startDate).run();

  return { previousTermId: active.id, termId: newTermId };
}
