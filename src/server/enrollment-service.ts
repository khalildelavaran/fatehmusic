export async function ensureNormalizedEnrollment(db: D1Database, classId: number, studentId: number): Promise<number> {
  const existing = await db.prepare(`SELECT id FROM enrollments WHERE class_id=? AND student_id=? AND status='active' LIMIT 1`).bind(classId,studentId).first<{id:number}>();
  if (existing) return existing.id;
  const source = await db.prepare(`SELECT id,enrollment_date FROM class_students WHERE class_id=? AND student_id=? AND status='active'`).bind(classId,studentId).first<{id:number;enrollment_date:string}>();
  if (!source) throw new Error('CLASS_STUDENT_NOT_ACTIVE');
  try {
    const inserted = await db.prepare(`INSERT INTO enrollments(class_id,student_id,enrolled_at,status,source_class_student_id) VALUES(?,?,?,'active',?)`).bind(classId,studentId,source.enrollment_date,source.id).run();
    if (typeof inserted.meta.last_row_id !== 'number') throw new Error('ENROLLMENT_CREATE_FAILED');
    return inserted.meta.last_row_id;
  } catch (error) {
    const concurrent = await db.prepare(`SELECT id FROM enrollments WHERE class_id=? AND student_id=? AND status='active' LIMIT 1`).bind(classId,studentId).first<{id:number}>();
    if (concurrent) return concurrent.id;
    throw error;
  }
}

export async function syncNormalizedEnrollmentStatus(db: D1Database, classId:number, studentId:number, status:'active'|'completed'|'withdrawn'): Promise<void> {
  await db.prepare(`UPDATE enrollments SET status=?,updated_at=datetime('now') WHERE class_id=? AND student_id=?`).bind(status,classId,studentId).run();
}
