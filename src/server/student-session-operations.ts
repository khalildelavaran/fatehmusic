import { createMakeupSession } from './class-sessions';

export async function setStudentSessionStatus(
  db: D1Database,
  enrollmentSessionId: number,
  status: 'present' | 'absent' | 'excused',
  note?: string | null,
): Promise<void> {
  const row = await db.prepare(`
    SELECT es.id, es.enrollment_id, es.session_id, es.enrollment_term_id,
           es.status AS current_status,
           e.status AS enrollment_status, e.class_id AS enrollment_class_id,
           cs.status AS session_status, cs.class_id AS session_class_id
    FROM enrollment_sessions es
    JOIN enrollments e ON e.id = es.enrollment_id
    JOIN class_sessions cs ON cs.id = es.session_id
    WHERE es.id = ?
  `).bind(enrollmentSessionId).first<{
    id:number; enrollment_id:number; session_id:number; enrollment_term_id:number|null;
    current_status:string;
    enrollment_status:string; enrollment_class_id:number; session_status:string; session_class_id:number;
  }>();
  if (!row) throw new Error('ENROLLMENT_SESSION_NOT_FOUND');
  if (row.enrollment_status !== 'active') throw new Error('ENROLLMENT_INACTIVE');
  if (row.enrollment_class_id !== row.session_class_id) throw new Error('ENROLLMENT_SESSION_CLASS_MISMATCH');
  if (row.enrollment_term_id == null) throw new Error('ENROLLMENT_TERM_REQUIRED');
  if (row.session_status === 'cancelled') throw new Error('SESSION_CANCELLED');

  // Once an excused occurrence has a makeup, the original occurrence is locked.
  // Otherwise changing it to present/absent would consume both occurrences.
  if (row.current_status === 'excused' && status !== 'excused') {
    const makeup = await db.prepare(`
      SELECT id
      FROM enrollment_sessions
      WHERE enrollment_id = ? AND makeup_for_id = ?
      LIMIT 1
    `).bind(row.enrollment_id, enrollmentSessionId).first<{ id:number }>();
    if (makeup) throw new Error('EXCUSED_SESSION_HAS_MAKEUP');
  }

  await db.prepare(`UPDATE enrollment_sessions SET status = ?, note = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(status, note ?? '', enrollmentSessionId).run();
}

export async function createStudentMakeup(
  db: D1Database,
  originalEnrollmentSessionId: number,
  input: {
    sessionDate: string; startTime: string; endTime: string; instructorId: number;
    roomId?: number | null; locationType?: 'in_person' | 'online' | 'hybrid';
    onlinePlatform?: string | null; meetingUrl?: string | null; notes?: string;
  },
): Promise<{ sessionId: number; enrollmentSessionId: number }> {
  const original = await db.prepare(`
    SELECT es.id, es.enrollment_id, es.session_id, es.status, es.enrollment_term_id,
           e.status AS enrollment_status
    FROM enrollment_sessions es
    JOIN enrollments e ON e.id = es.enrollment_id
    WHERE es.id = ?
  `).bind(originalEnrollmentSessionId).first<{
    id:number; enrollment_id:number; session_id:number; status:string;
    enrollment_term_id:number|null; enrollment_status:string;
  }>();
  if (!original) throw new Error('ENROLLMENT_SESSION_NOT_FOUND');
  if (original.enrollment_status !== 'active') throw new Error('ENROLLMENT_INACTIVE');
  if (original.enrollment_term_id == null) throw new Error('ENROLLMENT_TERM_REQUIRED');
  if (original.status !== 'excused') throw new Error('MAKEUP_REQUIRES_EXCUSED_SESSION');

  const existing = await db.prepare(`
    SELECT es.id
    FROM enrollment_sessions es
    WHERE es.enrollment_id = ? AND es.makeup_for_id = ?
  `).bind(original.enrollment_id, originalEnrollmentSessionId).first<{ id:number }>();
  if (existing) throw new Error('MAKEUP_ALREADY_CREATED');

  const { sessionId } = await createMakeupSessionForStudent(db, original.session_id, input);
  const inserted = await db.prepare(`
    INSERT INTO enrollment_sessions
      (enrollment_id, session_id, enrollment_term_id, status, makeup_for_id, note)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `).bind(original.enrollment_id, sessionId, original.enrollment_term_id, originalEnrollmentSessionId, 'جلسه جبرانی').run();
  if (typeof inserted.meta.last_row_id !== 'number') throw new Error('MAKEUP_ENROLLMENT_SESSION_CREATE_FAILED');
  return { sessionId, enrollmentSessionId: inserted.meta.last_row_id };
}

async function createMakeupSessionForStudent(
  db: D1Database,
  originalSessionId: number,
  input: Parameters<typeof createMakeupSession>[2],
): Promise<{ sessionId: number }> {
  const sessionId = await createMakeupSession(db, originalSessionId, input);
  return { sessionId };
}
