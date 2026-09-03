export const AUDIT_ACTOR_TYPES = ["admin", "registrar", "instructor", "student", "system"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export interface AuditActor {
  type: AuditActorType;
  id?: number | null;
  label?: string | null;
}

export interface AuditEvent {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogEntry {
  id: number;
  actorType: AuditActorType;
  actorId: number | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogListParams {
  entityType?: string | null;
  entityId?: number | null;
  actorType?: AuditActorType | null;
  page?: number | null;
  pageSize?: number | null;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function isAuditActorType(value: unknown): value is AuditActorType {
  return typeof value === "string" && (AUDIT_ACTOR_TYPES as readonly string[]).includes(value);
}

export function validateAuditEvent(event: AuditEvent): void {
  if (!isAuditActorType(event.actor?.type)) throw new Error("Invalid audit actor type");
  if (!event.action || !event.action.trim()) throw new Error("Invalid audit action");
  if (!event.entityType || !event.entityType.trim()) throw new Error("Invalid audit entity type");
}

function mapRow(row: any): AuditLogEntry {
  let metadata: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.metadata || "{}");
    if (parsed && typeof parsed === "object") metadata = parsed;
  } catch {
    metadata = {};
  }
  return {
    id: Number(row.id),
    actorType: row.actor_type,
    actorId: row.actor_id === null || row.actor_id === undefined ? null : Number(row.actor_id),
    actorLabel: String(row.actor_label || ""),
    action: String(row.action || ""),
    entityType: String(row.entity_type || ""),
    entityId: row.entity_id === null || row.entity_id === undefined ? null : Number(row.entity_id),
    metadata,
    createdAt: String(row.created_at || ""),
  };
}

/**
 * Appends one audit event. This never throws on a DB failure by design:
 * a logging failure must not block the underlying admin/instructor
 * operation it is describing. Callers that need to guarantee the write
 * happened should await the returned promise and check the result.
 */
export async function recordAuditEvent(db: D1Database, event: AuditEvent): Promise<boolean> {
  try {
    validateAuditEvent(event);
  } catch (error) {
    console.error("[audit-log] invalid event", error);
    return false;
  }

  try {
    const sql = `
      INSERT INTO audit_log (actor_type, actor_id, actor_label, action, entity_type, entity_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await db
      .prepare(sql)
      .bind(
        event.actor.type,
        event.actor.id ?? null,
        event.actor.label ?? "",
        event.action,
        event.entityType,
        event.entityId ?? null,
        JSON.stringify(event.metadata ?? {}),
      )
      .run();
    return true;
  } catch (error) {
    console.error("[audit-log] failed to record event", error);
    return false;
  }
}

export function normalizeAuditLogListParams(params: AuditLogListParams) {
  const pageNumber = Number(params.page);
  const sizeNumber = Number(params.pageSize);
  const page = Number.isFinite(pageNumber) ? Math.max(1, Math.floor(pageNumber)) : 1;
  const pageSize = Number.isFinite(sizeNumber)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(sizeNumber)))
    : DEFAULT_PAGE_SIZE;
  return {
    entityType: params.entityType ? String(params.entityType).trim() : null,
    entityId: Number.isInteger(Number(params.entityId)) && Number(params.entityId) > 0 ? Number(params.entityId) : null,
    actorType: isAuditActorType(params.actorType) ? params.actorType : null,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export async function listAuditLog(
  db: D1Database,
  params: AuditLogListParams,
): Promise<{ entries: AuditLogEntry[]; total: number; page: number; pageSize: number }> {
  const normalized = normalizeAuditLogListParams(params);
  const where: string[] = [];
  const bindings: unknown[] = [];

  if (normalized.entityType) {
    where.push("entity_type = ?");
    bindings.push(normalized.entityType);
  }
  if (normalized.entityId !== null) {
    where.push("entity_id = ?");
    bindings.push(normalized.entityId);
  }
  if (normalized.actorType) {
    where.push("actor_type = ?");
    bindings.push(normalized.actorType);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS count FROM audit_log ${whereSql}`)
    .bind(...bindings)
    .first<{ count: number }>();

  const listBindings = [...bindings, normalized.pageSize, normalized.offset];
  const rows = await db
    .prepare(
      `SELECT id, actor_type, actor_id, actor_label, action, entity_type, entity_id, metadata, created_at
       FROM audit_log ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...listBindings)
    .all();

  const entries = Array.isArray(rows.results) ? rows.results.map(mapRow) : [];

  return {
    entries,
    total: Number(totalRow?.count) || 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}
