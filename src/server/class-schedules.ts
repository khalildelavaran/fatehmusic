/*
 * Operational class schedules.
 * A schedule is a recurring template; it is never the source of truth for
 * a concrete meeting. Concrete meetings belong to class-sessions.
 */

export type ScheduleStatus = "active" | "inactive";

export interface ClassScheduleInput {
  classId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface ClassScheduleRecord extends ClassScheduleInput {
  id: number;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleRow {
  id: number;
  class_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_id: number | null;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapSchedule(row: ScheduleRow): ClassScheduleRecord {
  return {
    id: row.id,
    classId: row.class_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    roomId: row.room_id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    status: row.status === "inactive" ? "inactive" : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateClassSchedule(input: ClassScheduleInput): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(input.classId) || input.classId <= 0) errors.push("کلاس معتبر نیست.");
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    errors.push("روز هفته معتبر نیست.");
  }
  if (!validTime(input.startTime) || !validTime(input.endTime)) errors.push("ساعت جلسه معتبر نیست.");
  if (validTime(input.startTime) && validTime(input.endTime) && input.startTime >= input.endTime) {
    errors.push("ساعت پایان باید بعد از ساعت شروع باشد.");
  }
  if (input.effectiveFrom && input.effectiveTo && input.effectiveFrom > input.effectiveTo) {
    errors.push("بازه اعتبار برنامه معتبر نیست.");
  }
  return errors;
}

export async function listClassSchedules(db: D1Database, classId: number): Promise<ClassScheduleRecord[]> {
  const result = await db.prepare(
    `SELECT id, class_id, day_of_week, start_time, end_time, room_id,
            effective_from, effective_to, status, created_at, updated_at
     FROM class_schedules
     WHERE class_id = ?
     ORDER BY day_of_week, start_time, id`
  ).bind(classId).all<ScheduleRow>();
  return result.results.map(mapSchedule);
}

export async function createClassSchedule(db: D1Database, input: ClassScheduleInput): Promise<number> {
  const errors = validateClassSchedule(input);
  if (errors.length) throw new Error(errors.join(" "));

  const classRow = await db.prepare("SELECT id FROM classes WHERE id = ?").bind(input.classId).first<{ id: number }>();
  if (!classRow) throw new Error("کلاس یافت نشد.");

  const inserted = await db.prepare(
    `INSERT INTO class_schedules
      (class_id, day_of_week, start_time, end_time, room_id, effective_from, effective_to)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    input.classId,
    input.dayOfWeek,
    input.startTime,
    input.endTime,
    input.roomId ?? null,
    input.effectiveFrom ?? null,
    input.effectiveTo ?? null
  ).run();

  if (typeof inserted.meta.last_row_id !== "number") throw new Error("Failed to create class schedule");
  return inserted.meta.last_row_id;
}

export async function deactivateClassSchedule(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE class_schedules SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();
  return result.success;
}
