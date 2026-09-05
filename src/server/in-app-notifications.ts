/**
 * In-app notification inbox (SCHOOL-MANAGEMENT-IMPLEMENTATION.md
 * sections 36-37). Distinct from src/server/notifications.ts, which
 * sends an outbound Telegram/email alert to staff about a new
 * registration -- this module is the in-product notification list a
 * student, instructor, or admin sees inside their own portal.
 */

export const NOTIFICATION_TYPES = [
  "class_reminder",
  "payment_due",
  "attendance",
  "assignment",
  "evaluation",
  "certificate",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_RECIPIENT_TYPES = ["admin", "registrar", "instructor", "student"] as const;
export type NotificationRecipientType = (typeof NOTIFICATION_RECIPIENT_TYPES)[number];

export interface CreateNotificationInput {
  recipientType: NotificationRecipientType;
  recipientId?: number | null;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string | null;
  entityId?: number | null;
}

export interface NotificationEntry {
  id: number;
  recipientType: NotificationRecipientType;
  recipientId: number | null;
  type: NotificationType;
  channel: "in_app" | "sms";
  title: string;
  body: string;
  entityType: string | null;
  entityId: number | null;
  readAt: string | null;
  createdAt: string;
}

function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
function isRecipientType(value: unknown): value is NotificationRecipientType {
  return typeof value === "string" && (NOTIFICATION_RECIPIENT_TYPES as readonly string[]).includes(value);
}

function mapRow(row: any): NotificationEntry {
  return {
    id: Number(row.id),
    recipientType: row.recipient_type,
    recipientId: row.recipient_id === null || row.recipient_id === undefined ? null : Number(row.recipient_id),
    type: row.type,
    channel: row.channel,
    title: String(row.title || ""),
    body: String(row.body || ""),
    entityType: row.entity_type ?? null,
    entityId: row.entity_id === null || row.entity_id === undefined ? null : Number(row.entity_id),
    readAt: row.read_at ?? null,
    createdAt: String(row.created_at || ""),
  };
}

/**
 * Never throws: a notification failing to write must not fail the
 * underlying action it describes (same design as audit-log.ts).
 */
export async function createNotification(db: D1Database, input: CreateNotificationInput): Promise<boolean> {
  if (!isRecipientType(input.recipientType) || !isNotificationType(input.type) || !input.title?.trim()) {
    console.error("[notifications] invalid notification input", input);
    return false;
  }
  try {
    await db
      .prepare(
        `INSERT INTO notifications (recipient_type, recipient_id, type, title, body, entity_type, entity_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.recipientType,
        input.recipientId ?? null,
        input.type,
        input.title.trim(),
        input.body ?? "",
        input.entityType ?? null,
        input.entityId ?? null,
      )
      .run();
    return true;
  } catch (error) {
    console.error("[notifications] failed to create notification", error);
    return false;
  }
}

export interface ListNotificationsParams {
  recipientType: NotificationRecipientType;
  recipientId: number | null;
  unreadOnly?: boolean;
  limit?: number;
}

export async function listNotifications(db: D1Database, params: ListNotificationsParams): Promise<NotificationEntry[]> {
  const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
  const where: string[] = ["recipient_type = ?"];
  const bindings: unknown[] = [params.recipientType];

  if (params.recipientId === null) {
    where.push("recipient_id IS NULL");
  } else {
    where.push("(recipient_id = ? OR recipient_id IS NULL)");
    bindings.push(params.recipientId);
  }
  if (params.unreadOnly) where.push("read_at IS NULL");

  const rows = await db
    .prepare(
      `SELECT id, recipient_type, recipient_id, type, channel, title, body, entity_type, entity_id, read_at, created_at
       FROM notifications WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(...bindings, limit)
    .all();

  return (rows.results ?? []).map(mapRow);
}

export async function countUnreadNotifications(db: D1Database, recipientType: NotificationRecipientType, recipientId: number | null): Promise<number> {
  const where = recipientId === null ? "recipient_id IS NULL" : "(recipient_id = ? OR recipient_id IS NULL)";
  const bindings = recipientId === null ? [] : [recipientId];
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM notifications WHERE recipient_type = ? AND ${where} AND read_at IS NULL`)
    .bind(recipientType, ...bindings)
    .first<{ n: number }>();
  return Number(row?.n) || 0;
}

export async function markNotificationRead(db: D1Database, id: number, recipientType: NotificationRecipientType, recipientId: number | null): Promise<boolean> {
  const where = recipientId === null ? "recipient_id IS NULL" : "(recipient_id = ? OR recipient_id IS NULL)";
  const bindings = recipientId === null ? [id, recipientType] : [id, recipientType, recipientId];
  const result = await db
    .prepare(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND recipient_type = ? AND ${where} AND read_at IS NULL`)
    .bind(...bindings)
    .run();
  return (result?.meta?.changes ?? 0) > 0;
}

export async function markAllNotificationsRead(db: D1Database, recipientType: NotificationRecipientType, recipientId: number | null): Promise<number> {
  const where = recipientId === null ? "recipient_id IS NULL" : "(recipient_id = ? OR recipient_id IS NULL)";
  const bindings = recipientId === null ? [recipientType] : [recipientType, recipientId];
  const result = await db
    .prepare(`UPDATE notifications SET read_at = datetime('now') WHERE recipient_type = ? AND ${where} AND read_at IS NULL`)
    .bind(...bindings)
    .run();
  return result?.meta?.changes ?? 0;
}

// ---------------------------------------------------------------------
// Section 37: Class Reminder
// ---------------------------------------------------------------------

/**
 * Creates a class_reminder notification for every active student in
 * every not-yet-reminded session starting within the given lookahead
 * window, and for the session's instructor. Idempotent: re-running for
 * the same session skips students/instructor who already have a
 * reminder for that session (checked via entity_type/entity_id).
 *
 * Intended to be invoked by a scheduled job (e.g. a Cloudflare Cron
 * Trigger) a fixed interval before each class_session's start_time;
 * this function itself is pure with respect to "now" (the caller
 * supplies windowStart/windowEnd) so it stays unit-testable without a
 * live clock.
 */
export async function generateClassReminders(
  db: D1Database,
  today: string,
  windowStartTime: string,
  windowEndTime: string,
): Promise<number> {
  const sessions = await db
    .prepare(
      `SELECT cs.id AS session_id, cs.class_id, cs.start_time, cs.instructor_id, c.title AS class_title
       FROM class_sessions cs
       JOIN classes c ON c.id = cs.class_id
       WHERE cs.session_date = ? AND cs.start_time BETWEEN ? AND ? AND cs.status != 'cancelled'`,
    )
    .bind(today, windowStartTime, windowEndTime)
    .all<{ session_id: number; class_id: number; start_time: string; instructor_id: number; class_title: string }>();

  let created = 0;
  for (const session of sessions.results ?? []) {
    const alreadyRemindedInstructor = await db
      .prepare(`SELECT 1 FROM notifications WHERE type = 'class_reminder' AND entity_type = 'class_session' AND entity_id = ? AND recipient_type = 'instructor' AND recipient_id = ?`)
      .bind(session.session_id, session.instructor_id)
      .first();
    if (!alreadyRemindedInstructor) {
      const ok = await createNotification(db, {
        recipientType: "instructor",
        recipientId: session.instructor_id,
        type: "class_reminder",
        title: `یادآوری کلاس: ${session.class_title}`,
        body: `کلاس «${session.class_title}» ساعت ${session.start_time} برگزار می‌شود.`,
        entityType: "class_session",
        entityId: session.session_id,
      });
      if (ok) created++;
    }

    const students = await db
      .prepare(
        `SELECT DISTINCT e.student_id
         FROM enrollment_sessions es
         JOIN enrollments e ON e.id = es.enrollment_id
         WHERE es.session_id = ? AND e.status = 'active'`,
      )
      .bind(session.session_id)
      .all<{ student_id: number }>();

    for (const student of students.results ?? []) {
      const alreadyReminded = await db
        .prepare(`SELECT 1 FROM notifications WHERE type = 'class_reminder' AND entity_type = 'class_session' AND entity_id = ? AND recipient_type = 'student' AND recipient_id = ?`)
        .bind(session.session_id, student.student_id)
        .first();
      if (alreadyReminded) continue;
      const ok = await createNotification(db, {
        recipientType: "student",
        recipientId: student.student_id,
        type: "class_reminder",
        title: `یادآوری کلاس: ${session.class_title}`,
        body: `کلاس «${session.class_title}» ساعت ${session.start_time} برگزار می‌شود.`,
        entityType: "class_session",
        entityId: session.session_id,
      });
      if (ok) created++;
    }
  }

  return created;
}
