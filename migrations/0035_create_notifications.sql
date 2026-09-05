-- ====================================================================
-- Migration 0035: internal notifications
--
-- In-app notification inbox (SCHOOL-MANAGEMENT-IMPLEMENTATION.md
-- sections 36-37). recipient_type/recipient_id follow the same actor
-- vocabulary as audit_log (0033) so a notification can be addressed to
-- a student, an instructor, or (recipient_id NULL) broadcast to all
-- admins. channel is included now, defaulted to 'in_app', so an SMS
-- channel can be added later without a schema change (per spec: "در
-- Phase اول Notification داخل سایت کافی است؛ معماری برای SMS در آینده
-- آماده باشد").
-- ====================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL,
  recipient_id   INTEGER,
  type           TEXT NOT NULL,
  channel        TEXT NOT NULL DEFAULT 'in_app',
  title          TEXT NOT NULL,
  body           TEXT NOT NULL DEFAULT '',
  entity_type    TEXT,
  entity_id      INTEGER,
  read_at        TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (recipient_type IN ('admin', 'registrar', 'instructor', 'student')),
  CHECK (type IN ('class_reminder', 'payment_due', 'attendance', 'assignment', 'evaluation', 'certificate', 'system')),
  CHECK (channel IN ('in_app', 'sms'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
