/*
 * Concrete class sessions.
 * Session is the operational source of truth for date, time, instructor,
 * room and delivery mode. It may intentionally differ from the recurring
 * schedule, including on an official holiday.
 */

export type SessionType = "regular" | "makeup";
export type SessionStatus = "scheduled" | "completed" | "cancelled";
export type LocationType = "in_person" | "online" | "hybrid";

export interface ClassSessionInput {
  classId: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  instructorId: number;
  roomId?: number | null;
  locationType?: LocationType;
  onlinePlatform?: string | null;
  meetingUrl?: string | null;
  type?: SessionType;
  originalSessionId?: number | null;
  notes?: string;
}

export interface ClassSessionRecord extends ClassSessionInput {
  id: number;
  status: SessionStatus;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: number;
  class_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  instructor_id: number;
  room_id: number | null;
  location_type: string;
  online_platform: string | null;
  meeting_url: string | null;
  type: string;
  status: string;
  cancellation_reason: string | null;
  original_session_id: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

function mapSession(row: SessionRow): ClassSessionRecord {
  return {
    id: row.id,
    classId: row.class_id,
    sessionDate: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    instructorId: row.instructor_id,
    roomId: row.room_id,
    locationType: row.location_type === "online" || row.location_type === "hybrid" ? row.location_type : "in_person",
    onlinePlatform: row.online_platform,
    meetingUrl: row.meeting_url,
    type: row.type === "makeup" ? "makeup" : "regular",
    status: row.status === "completed" || row.status === "cancelled" ? row.status : "scheduled",
    originalSessionId: row.original_session_id,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateClassSession(input: ClassSessionInput): string[] {
  const errors: string[] = [];
  const locationType = input.locationType ?? "in_person";
  const type = input.type ?? "regular";

  if (!Number.isInteger(input.classId) || input.classId <= 0) errors.push("کلاس معتبر نیست.");
  if (!validDate(input.sessionDate)) errors.push("تاریخ جلسه معتبر نیست.");
  if (!validTime(input.startTime) || !validTime(input.endTime)) errors.push("ساعت جلسه معتبر نیست.");
  if (validTime(input.startTime) && validTime(input.endTime) && input.startTime >= input.endTime) {
    errors.push("ساعت پایان باید بعد از ساعت شروع باشد.");
  }
  if (!Number.isInteger(input.instructorId) || input.instructorId <= 0) errors.push("مدرس معتبر نیست.");
  if (locationType === "online" && !input.meetingUrl) errors.push("برای جلسه آنلاین لینک ورود الزامی است.");
  if ((locationType === "in_person" || locationType === "hybrid") && input.roomId == null) {
    errors.push("برای جلسه حضوری یا ترکیبی اتاق الزامی است.");
  }
  if (type === "makeup" && (!Number.isInteger(input.originalSessionId) || (input.originalSessionId ?? 0) <= 0)) {
    errors.push("جلسه جبرانی باید به جلسه اصلی متصل باشد.");
  }
  if (type === "regular" && input.originalSessionId != null) {
    errors.push("جلسه عادی نباید به‌عنوان جبرانی به جلسه دیگری متصل باشد.");
  }

  return errors;
}

const SESSION_COLUMNS = `
  id, class_id, session_date, start_time, end_time, instructor_id, room_id,
  location_type, online_platform, meeting_url, type, status,
  cancellation_reason, original_session_id, notes, created_at, updated_at`;

export async function getSession(db: D1Database, id: number): Promise<ClassSessionRecord | null> {
  const row = await db.prepare(`SELECT ${SESSION_COLUMNS} FROM class_sessions WHERE id = ?`).bind(id).first<SessionRow>();
  return row ? mapSession(row) : null;
}

export async function listSessionsForDate(db: D1Database, date: string): Promise<ClassSessionRecord[]> {
  const result = await db.prepare(`
    SELECT ${SESSION_COLUMNS}
    FROM class_sessions
    WHERE session_date = ?
    ORDER BY start_time, id
  `).bind(date).all<SessionRow>();
  return result.results.map(mapSession);
}

export async function listSessionsForClass(
  db: D1Database,
  classId: number,
  fromDate?: string,
  toDate?: string,
): Promise<ClassSessionRecord[]> {
  const clauses = ["class_id = ?"];
  const binds: unknown[] = [classId];
  if (fromDate) { clauses.push("session_date >= ?"); binds.push(fromDate); }
  if (toDate) { clauses.push("session_date <= ?"); binds.push(toDate); }

  const result = await db.prepare(`
    SELECT ${SESSION_COLUMNS}
    FROM class_sessions
    WHERE ${clauses.join(" AND ")}
    ORDER BY session_date, start_time, id
  `).bind(...binds).all<SessionRow>();
  return result.results.map(mapSession);
}

export async function createClassSession(db: D1Database, input: ClassSessionInput): Promise<number> {
  const normalized: ClassSessionInput = {
    ...input,
    locationType: input.locationType ?? "in_person",
    type: input.type ?? "regular",
  };
  const errors = validateClassSession(normalized);
  if (errors.length) throw new Error(errors.join(" "));

  const classRow = await db.prepare("SELECT id FROM classes WHERE id = ?").bind(normalized.classId).first<{ id: number }>();
  if (!classRow) throw new Error("کلاس یافت نشد.");

  const instructor = await db.prepare("SELECT id FROM instructors WHERE id = ? AND is_active = 1")
    .bind(normalized.instructorId).first<{ id: number }>();
  if (!instructor) throw new Error("مدرس فعال یافت نشد.");

  if (normalized.roomId != null) {
    const room = await db.prepare("SELECT id FROM rooms WHERE id = ? AND status = 'active'")
      .bind(normalized.roomId).first<{ id: number }>();
    if (!room) throw new Error("اتاق فعال یافت نشد.");
  }

  if (normalized.type === "makeup") {
    const original = await db.prepare(`
      SELECT id FROM class_sessions
      WHERE id = ? AND class_id = ?
    `).bind(normalized.originalSessionId, normalized.classId).first<{ id: number }>();
    if (!original) throw new Error("جلسه اصلی جبرانی یافت نشد یا متعلق به این کلاس نیست.");
  }

  const inserted = await db.prepare(`
    INSERT INTO class_sessions
      (class_id, session_date, start_time, end_time, instructor_id, room_id,
       location_type, online_platform, meeting_url, type, original_session_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    normalized.classId,
    normalized.sessionDate,
    normalized.startTime,
    normalized.endTime,
    normalized.instructorId,
    normalized.roomId ?? null,
    normalized.locationType,
    normalized.onlinePlatform ?? null,
    normalized.meetingUrl ?? null,
    normalized.type,
    normalized.originalSessionId ?? null,
    normalized.notes ?? "",
  ).run();

  if (typeof inserted.meta.last_row_id !== "number") throw new Error("SESSION_CREATE_FAILED");
  return inserted.meta.last_row_id;
}

export async function cancelClassSession(db: D1Database, id: number, reason: string): Promise<boolean> {
  const result = await db.prepare(`
    UPDATE class_sessions
    SET status = 'cancelled', cancellation_reason = ?, updated_at = datetime('now')
    WHERE id = ? AND status = 'scheduled'
  `).bind(reason, id).run();
  return result.success;
}

export async function completeClassSession(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`
    UPDATE class_sessions
    SET status = 'completed', updated_at = datetime('now')
    WHERE id = ? AND status = 'scheduled'
  `).bind(id).run();
  return result.success;
}

export async function createMakeupSession(
  db: D1Database,
  originalSessionId: number,
  input: Omit<ClassSessionInput, "classId" | "type" | "originalSessionId">,
): Promise<number> {
  const original = await getSession(db, originalSessionId);
  if (!original) throw new Error("جلسه اصلی یافت نشد.");
  return createClassSession(db, {
    ...input,
    classId: original.classId,
    type: "makeup",
    originalSessionId,
  });
}
