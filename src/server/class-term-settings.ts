export type ClassBillingType = 'session_based' | 'monthly';

export type ClassTermSettings = {
  classId: number;
  billingType: ClassBillingType;
  plannedSessions: number | null;
  tuitionAmount: number | null;
  tuitionDueDays: number | null;
};

function validate(settings: Omit<ClassTermSettings, 'classId'>): void {
  if (settings.billingType !== 'session_based' && settings.billingType !== 'monthly') throw new Error('INVALID_BILLING_TYPE');
  if (settings.plannedSessions != null && (!Number.isInteger(settings.plannedSessions) || settings.plannedSessions <= 0)) throw new Error('INVALID_PLANNED_SESSIONS');
  if (settings.billingType === 'monthly' && settings.plannedSessions != null) throw new Error('MONTHLY_CANNOT_HAVE_PLANNED_SESSIONS');
  if (settings.billingType === 'session_based' && settings.plannedSessions == null) throw new Error('SESSION_BASED_REQUIRES_PLANNED_SESSIONS');
  if (settings.tuitionAmount != null && (!Number.isInteger(settings.tuitionAmount) || settings.tuitionAmount < 0)) throw new Error('INVALID_TUITION_AMOUNT');
  if (settings.tuitionDueDays != null && (!Number.isInteger(settings.tuitionDueDays) || settings.tuitionDueDays < 0)) throw new Error('INVALID_TUITION_DUE_DAYS');
}

export async function getClassTermSettings(db: D1Database, classId: number): Promise<ClassTermSettings | null> {
  const row = await db.prepare(`SELECT class_id,billing_type,planned_sessions,tuition_amount,tuition_due_days FROM class_term_settings WHERE class_id=?`).bind(classId).first<{class_id:number;billing_type:string;planned_sessions:number|null;tuition_amount:number|null;tuition_due_days:number|null}>();
  if (!row) return null;
  return { classId:row.class_id, billingType:row.billing_type as ClassBillingType, plannedSessions:row.planned_sessions, tuitionAmount:row.tuition_amount, tuitionDueDays:row.tuition_due_days };
}

export async function saveClassTermSettings(db: D1Database, settings: ClassTermSettings): Promise<void> {
  validate(settings);
  const exists = await db.prepare(`SELECT id FROM classes WHERE id=?`).bind(settings.classId).first();
  if (!exists) throw new Error('CLASS_NOT_FOUND');
  await db.prepare(`INSERT INTO class_term_settings(class_id,billing_type,planned_sessions,tuition_amount,tuition_due_days) VALUES(?,?,?,?,?) ON CONFLICT(class_id) DO UPDATE SET billing_type=excluded.billing_type,planned_sessions=excluded.planned_sessions,tuition_amount=excluded.tuition_amount,tuition_due_days=excluded.tuition_due_days,updated_at=datetime('now')`).bind(settings.classId,settings.billingType,settings.plannedSessions,settings.tuitionAmount,settings.tuitionDueDays).run();
}
