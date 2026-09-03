export type RoomStatus = 'active' | 'inactive';

export type RoomRecord = {
  id: number;
  branchId: number | null;
  name: string;
  capacity: number;
  status: RoomStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomInput = {
  branchId?: number | null;
  name: string;
  capacity?: number;
  notes?: string;
};

type RoomRow = {
  id: number;
  branch_id: number | null;
  name: string;
  capacity: number;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

function mapRoom(row: RoomRow): RoomRecord {
  return {
    id: row.id,
    branchId: row.branch_id,
    name: row.name,
    capacity: row.capacity,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateRoom(input: RoomInput): void {
  if (!input.name?.trim()) throw new Error('ROOM_NAME_REQUIRED');
  const capacity = input.capacity ?? 1;
  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('INVALID_ROOM_CAPACITY');
  if (input.branchId != null && (!Number.isInteger(input.branchId) || input.branchId <= 0)) {
    throw new Error('INVALID_BRANCH');
  }
}

export async function listRooms(db: D1Database, includeInactive = false): Promise<RoomRecord[]> {
  const result = await db.prepare(`
    SELECT id, branch_id, name, capacity, status, notes, created_at, updated_at
    FROM rooms
    WHERE ? = 1 OR status = 'active'
    ORDER BY status = 'inactive', name, id
  `).bind(includeInactive ? 1 : 0).all<RoomRow>();
  return result.results.map(mapRoom);
}

export async function createRoom(db: D1Database, input: RoomInput): Promise<RoomRecord> {
  validateRoom(input);
  const name = input.name.trim();

  const duplicate = await db.prepare(`
    SELECT id FROM rooms
    WHERE status = 'active'
      AND name = ?
      AND (branch_id IS ? OR branch_id = ?)
    LIMIT 1
  `).bind(name, input.branchId ?? null, input.branchId ?? null).first<{ id: number }>();
  if (duplicate) throw new Error('ROOM_ALREADY_EXISTS');

  const inserted = await db.prepare(`
    INSERT INTO rooms (branch_id, name, capacity, status, notes)
    VALUES (?, ?, ?, 'active', ?)
    RETURNING id, branch_id, name, capacity, status, notes, created_at, updated_at
  `).bind(input.branchId ?? null, name, input.capacity ?? 1, input.notes?.trim() ?? '').first<RoomRow>();

  if (!inserted) throw new Error('ROOM_CREATE_FAILED');
  return mapRoom(inserted);
}

export async function updateRoom(
  db: D1Database,
  id: number,
  input: Partial<RoomInput> & { status?: RoomStatus },
): Promise<RoomRecord> {
  const current = await db.prepare(`
    SELECT id, branch_id, name, capacity, status, notes, created_at, updated_at
    FROM rooms WHERE id = ?
  `).bind(id).first<RoomRow>();
  if (!current) throw new Error('ROOM_NOT_FOUND');

  const next: RoomInput = {
    branchId: input.branchId === undefined ? current.branch_id : input.branchId,
    name: input.name === undefined ? current.name : input.name,
    capacity: input.capacity === undefined ? current.capacity : input.capacity,
    notes: input.notes === undefined ? current.notes : input.notes,
  };
  validateRoom(next);

  const status = input.status ?? (current.status === 'inactive' ? 'inactive' : 'active');
  if (status !== 'active' && status !== 'inactive') throw new Error('INVALID_ROOM_STATUS');

  if (status === 'inactive') {
    const scheduledUse = await db.prepare(`
      SELECT 1
      FROM class_schedules
      WHERE room_id = ? AND status = 'active'
      LIMIT 1
    `).bind(id).first();
    if (scheduledUse) throw new Error('ROOM_HAS_ACTIVE_SCHEDULE');
  }

  const duplicate = await db.prepare(`
    SELECT id FROM rooms
    WHERE id <> ? AND status = 'active' AND name = ?
      AND (branch_id IS ? OR branch_id = ?)
    LIMIT 1
  `).bind(id, next.name.trim(), next.branchId ?? null, next.branchId ?? null).first<{ id: number }>();
  if (duplicate && status === 'active') throw new Error('ROOM_ALREADY_EXISTS');

  const updated = await db.prepare(`
    UPDATE rooms
    SET branch_id = ?, name = ?, capacity = ?, status = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
    RETURNING id, branch_id, name, capacity, status, notes, created_at, updated_at
  `).bind(
    next.branchId ?? null,
    next.name.trim(),
    next.capacity ?? 1,
    status,
    next.notes?.trim() ?? '',
    id,
  ).first<RoomRow>();

  if (!updated) throw new Error('ROOM_UPDATE_FAILED');
  return mapRoom(updated);
}
