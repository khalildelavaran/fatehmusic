-- Student portal accounts and issued certificate records.
-- Passwords are never stored in plain text; the initial password is the national code.

CREATE TABLE IF NOT EXISTS student_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  national_code TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_accounts_active ON student_accounts(is_active);

CREATE TABLE IF NOT EXISTS issued_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL,
  national_code TEXT NOT NULL,
  cert_number TEXT NOT NULL UNIQUE,
  completion_date_jalali TEXT NOT NULL,
  level TEXT,
  book_id INTEGER,
  curriculum_note TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_issued_certificates_registration ON issued_certificates(registration_id);
CREATE INDEX IF NOT EXISTS idx_issued_certificates_national_code ON issued_certificates(national_code);
