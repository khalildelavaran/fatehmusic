/*
 * Room resource management.
 * `rooms` already exists (migration 0022_operational_education_domain.sql)
 * and is referenced by class_sessions.room_id, class_schedules.room_id and
 * classes.default_room_id. This module adds no new schema — it only adds
 * the CRUD surface the settings page and the daily dashboard need.
 *
 * A room is never hard-deleted if it is still referenced by any class
 * session (past or future) or by a class's default room / recurring
 * schedule: deleting it would silently corrupt historical daily-dashboard
 * and reporting data. Deactivating (status = 'inactive') is the supported
 * way to retire a room from the daily timeline while keeping history intact.
 */

export type RoomStatus = "active" | "inactive";

export interface RoomRecord {
  id: number;
  name: string;
  capacity: number;
  status: RoomStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface RoomRow {
  id: number;
  name: string;
  capacity: number;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function mapRoom(row: RoomRow): RoomRecord {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    status: row.status === "inactive" ? "inactive" : "active",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ROOM_COLUMNS = "id, name, capacity, status, notes, created_at, updated_at";

/** Active rooms, in display order. Used by the daily dashboard to build timeline columns. */
export async function listActiveRooms(db: D1Database): Promise<RoomRecord[]> {
  const rows = await db.prepare(
    `SELECT ${ROOM_COLUMNS} FROM rooms WHERE status = 'active' ORDER BY id ASC`
  ).all<RoomRow>();
  return (rows.results || []).map(mapRoom);
}

/** All rooms (active and inactive), for the settings page. */
export async function listAllRooms(db: D1Database): Promise<RoomRecord[]> {
  const rows = await db.prepare(
    `SELECT ${ROOM_COLUMNS} FROM rooms ORDER BY status ASC, id ASC`
  ).all<RoomRow>();
  return (rows.results || []).map(mapRoom);
}

export async function getRoom(db: D1Database, id: number): Promise<RoomRecord | null> {
  const row = await db.prepare(`SELECT ${ROOM_COLUMNS} FROM rooms WHERE id = ? LIMIT 1`).bind(id).first<RoomRow>();
  return row ? mapRoom(row) : null;
}

export interface CreateRoomInput {
  name: string;
  capacity?: number | null;
  notes?: string | null;
}

export async function createRoom(db: D1Database, input: CreateRoomInput): Promise<RoomRecord> {
  const name = input.name.trim();
  const capacity = Number.isInteger(input.capacity) && (input.capacity as number) > 0 ? (input.capacity as number) : 1;
  const notes = (input.notes ?? "").trim();
  const inserted = await db.prepare(
    `INSERT INTO rooms (name, capacity, status, notes) VALUES (?, ?, 'active', ?) RETURNING ${ROOM_COLUMNS}`
  ).bind(name, capacity, notes).first<RoomRow>();
  if (!inserted) throw new Error("ROOM_CREATE_FAILED");
  return mapRoom(inserted);
}

export interface UpdateRoomInput {
  name?: string;
  capacity?: number | null;
  notes?: string | null;
  status?: RoomStatus;
}

export async function updateRoom(db: D1Database, id: number, input: UpdateRoomInput): Promise<RoomRecord | null> {
  const existing = await getRoom(db, id);
  if (!existing) return null;

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const capacity = input.capacity !== undefined
    ? (Number.isInteger(input.capacity) && (input.capacity as number) > 0 ? (input.capacity as number) : existing.capacity)
    : existing.capacity;
  const notes = input.notes !== undefined ? (input.notes ?? "").trim() : existing.notes;
  const status = input.status !== undefined ? input.status : existing.status;

  const updated = await db.prepare(
    `UPDATE rooms SET name = ?, capacity = ?, notes = ?, status = ?, updated_at = datetime('now')
     WHERE id = ? RETURNING ${ROOM_COLUMNS}`
  ).bind(name, capacity, notes, status, id).first<RoomRow>();
  return updated ? mapRoom(updated) : null;
}

export interface RoomDeleteBlockedReason {
  blocked: true;
  reason: "future_sessions" | "referenced_by_class";
  message: string;
}

/**
 * A room may only be hard-deleted if nothing references it: no class_session
 * (past or future — deleting would corrupt historical daily-dashboard data),
 * no class_schedule, and no class.default_room_id.
 */
export async function checkRoomDeletable(db: D1Database, id: number): Promise<RoomDeleteBlockedReason | null> {
  const sessionUse = await db.prepare(
    `SELECT id FROM class_sessions WHERE room_id = ? LIMIT 1`
  ).bind(id).first<{ id: number }>();
  if (sessionUse) {
    return {
      blocked: true,
      reason: "future_sessions",
      message: "این اتاق در جلسات کلاس (گذشته یا آینده) استفاده شده و قابل حذف نیست. می‌توانید آن را غیرفعال کنید.",
    };
  }

  const scheduleUse = await db.prepare(
    `SELECT id FROM class_schedules WHERE room_id = ? AND status = 'active' LIMIT 1`
  ).bind(id).first<{ id: number }>();
  if (scheduleUse) {
    return {
      blocked: true,
      reason: "referenced_by_class",
      message: "این اتاق در برنامه هفتگی یک کلاس استفاده می‌شود و قابل حذف نیست. می‌توانید آن را غیرفعال کنید.",
    };
  }

  const classUse = await db.prepare(
    `SELECT id FROM classes WHERE default_room_id = ? AND status = 'active' LIMIT 1`
  ).bind(id).first<{ id: number }>();
  if (classUse) {
    return {
      blocked: true,
      reason: "referenced_by_class",
      message: "این اتاق به‌عنوان اتاق پیش‌فرض یک کلاس فعال تنظیم شده و قابل حذف نیست. می‌توانید آن را غیرفعال کنید.",
    };
  }

  return null;
}

export async function deleteRoom(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM rooms WHERE id = ?`).bind(id).run();
  return !!result.meta.changes;
}
