CREATE TABLE IF NOT EXISTS instructor_settlements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id    INTEGER NOT NULL,
  settlement_month TEXT NOT NULL,
  amount           INTEGER NOT NULL CHECK (amount >= 0),
  payment_method   TEXT NOT NULL DEFAULT 'cash',
  paid_at         TEXT NOT NULL DEFAULT (datetime('now')),
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (payment_method IN ('cash', 'pos', 'transfer', 'online', 'other')),
  UNIQUE (instructor_id, settlement_month)
);

CREATE INDEX IF NOT EXISTS idx_instructor_settlements_month
  ON instructor_settlements(settlement_month);

CREATE INDEX IF NOT EXISTS idx_instructor_settlements_instructor
  ON instructor_settlements(instructor_id);
