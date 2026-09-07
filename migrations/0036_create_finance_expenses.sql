-- ====================================================================
-- Migration 0036: academy finance expenses
--
-- Explicit operating expenses are kept separate from student payments so
-- the finance center can report cash income, receivables, expenses and
-- net operating result without changing the existing invoice/payment model.
-- ====================================================================

CREATE TABLE IF NOT EXISTS finance_expenses (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date     TEXT NOT NULL,
  category         TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  amount           INTEGER NOT NULL CHECK (amount > 0),
  payment_method   TEXT NOT NULL DEFAULT 'cash',
  reference        TEXT,
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (payment_method IN ('cash', 'pos', 'transfer', 'online', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_date ON finance_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON finance_expenses(category);

-- Instructor monthly settlement ledger. The payable amount is calculated
-- from the instructor workload; this table records the settlement state.
CREATE TABLE IF NOT EXISTS instructor_settlements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id    INTEGER NOT NULL,
  settlement_month TEXT NOT NULL,
  amount_due       INTEGER NOT NULL CHECK (amount_due >= 0),
  paid_amount      INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at          TEXT,
  payment_method   TEXT NOT NULL DEFAULT 'cash',
  reference        TEXT,
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (instructor_id, settlement_month),
  CHECK (payment_method IN ('cash', 'pos', 'transfer', 'online', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_instructor_settlements_month ON instructor_settlements(settlement_month);
CREATE INDEX IF NOT EXISTS idx_instructor_settlements_instructor ON instructor_settlements(instructor_id);
