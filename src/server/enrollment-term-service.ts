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

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
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