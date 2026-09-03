import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { provisionEnrollmentSessionsForClassSession } from '../../src/server/session-provisioning';
import { renewEnrollmentTerm } from '../../src/server/enrollment-term-service';

type TestEnv = { DB: D1Database };

type EnrollmentSessionRow = {
  session_id: number;
  enrollment_term_id: number | null;
  status: string;
};

type InvoiceRow = {
  id: number;
  enrollment_term_id: number;
  amount: number;
  status: string;
};

describe('D1 enrollment term transition', () => {
  let mf: Miniflare;
  let db: D1Database;
  let term1Id: number;
  let term1InvoiceId: number;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: { DB: 'fatehmusic-d1-term-transition-test' },
    });

    const env = await mf.getBindings<TestEnv>();
    db = env.DB;

    await db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );

      CREATE TABLE enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE class_term_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL UNIQUE,
        billing_type TEXT NOT NULL,
        planned_sessions INTEGER,
        tuition_amount INTEGER,
        tuition_due_days INTEGER,
        updated_at TEXT DEFAULT datetime('now')
      );

      CREATE TABLE class_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        session_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled'
      );

      CREATE TABLE enrollment_terms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        term_number INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        planned_sessions INTEGER,
        billing_type TEXT NOT NULL,
        tuition_amount INTEGER,
        tuition_due_date TEXT,
        status TEXT NOT NULL,
        updated_at TEXT DEFAULT datetime('now')
      );

      CREATE UNIQUE INDEX idx_test_one_active_term
        ON enrollment_terms(enrollment_id)
        WHERE status = 'active';

      CREATE TABLE enrollment_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        enrollment_term_id INTEGER,
        status TEXT NOT NULL,
        updated_at TEXT DEFAULT datetime('now')
      );

      CREATE UNIQUE INDEX idx_test_unique_enrollment_session
        ON enrollment_sessions(enrollment_id, session_id);

      CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_term_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        amount INTEGER NOT NULL
      );

      INSERT INTO classes (id, name) VALUES (1, 'گیتار');
      INSERT INTO enrollments (id, class_id, student_id, status)
      VALUES (1, 1, 1, 'active');
      INSERT INTO class_term_settings
        (class_id, billing_type, planned_sessions, tuition_amount, tuition_due_days)
      VALUES (1, 'session_based', 8, 800000, 7);
    `);
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it('keeps completed term sessions immutable and provisions the next session into the renewed term', async () => {
    for (let index = 1; index <= 9; index += 1) {
      const sessionDate = `2026-08-${String(index).padStart(2, '0')}`;
      await db.prepare(`
        INSERT INTO class_sessions (id, class_id, session_date, status)
        VALUES (?, 1, ?, 'scheduled')
      `).bind(index, sessionDate).run();
    }

    for (let sessionId = 1; sessionId <= 8; sessionId += 1) {
      await provisionEnrollmentSessionsForClassSession(db, sessionId);
      await db.prepare(`
        UPDATE enrollment_sessions
        SET status = 'present'
        WHERE enrollment_id = 1 AND session_id = ?
      `).bind(sessionId).run();
    }

    const term1 = await db.prepare(`
      SELECT id, term_number, status
      FROM enrollment_terms
      WHERE enrollment_id = 1 AND status = 'active'
    `).first<{ id: number; term_number: number; status: string }>();

    expect(term1).toMatchObject({ term_number: 1, status: 'active' });
    term1Id = term1!.id;

    const term1Invoice = await db.prepare(`
      SELECT id, enrollment_term_id, amount, status
      FROM invoices
      WHERE enrollment_term_id = ?
      ORDER BY id
      LIMIT 1
    `).bind(term1Id).first<InvoiceRow>();

    expect(term1Invoice).toMatchObject({
      enrollment_term_id: term1Id,
      amount: 800000,
      status: 'pending',
    });
    term1InvoiceId = term1Invoice!.id;

    await db.prepare(`
      INSERT INTO payments (invoice_id, amount) VALUES (?, 300000)
    `).bind(term1InvoiceId).run();

    const consumedBeforeRenewal = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM enrollment_sessions
      WHERE enrollment_id = 1
        AND enrollment_term_id = ?
        AND status IN ('present', 'absent')
    `).bind(term1Id).first<{ count: number }>();
    expect(consumedBeforeRenewal?.count).toBe(8);

    const renewal = await renewEnrollmentTerm(db, 1, '2026-08-10');
    expect(renewal.previousTermId).toBe(term1Id);
    expect(renewal.termNumber).toBe(2);
    expect(renewal.tuitionAmount).toBe(800000);
    expect(renewal.invoiceId).not.toBeNull();

    await provisionEnrollmentSessionsForClassSession(db, 9);

    const rows = await db.prepare(`
      SELECT session_id, enrollment_term_id, status
      FROM enrollment_sessions
      WHERE enrollment_id = 1
      ORDER BY session_id
    `).all<EnrollmentSessionRow>();

    expect(rows.results).toHaveLength(9);
    expect(rows.results.slice(0, 8).every((row) => row.enrollment_term_id === term1Id)).toBe(true);
    expect(rows.results[8].enrollment_term_id).toBe(renewal.termId);
    expect(rows.results.slice(0, 8).every((row) => row.status === 'present')).toBe(true);
    expect(rows.results[8].status).toBe('pending');

    const consumedAfterRenewal = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM enrollment_sessions
      WHERE enrollment_id = 1
        AND enrollment_term_id = ?
        AND status IN ('present', 'absent')
    `).bind(term1Id).first<{ count: number }>();
    expect(consumedAfterRenewal?.count).toBe(8);

    // Re-provisioning an old session must never migrate its historical term.
    await provisionEnrollmentSessionsForClassSession(db, 1);
    const oldSession = await db.prepare(`
      SELECT enrollment_term_id
      FROM enrollment_sessions
      WHERE enrollment_id = 1 AND session_id = 1
    `).first<{ enrollment_term_id: number }>();
    expect(oldSession?.enrollment_term_id).toBe(term1Id);

    const termRows = await db.prepare(`
      SELECT id, term_number, status
      FROM enrollment_terms
      WHERE enrollment_id = 1
      ORDER BY term_number
    `).all<{ id: number; term_number: number; status: string }>();
    expect(termRows.results).toEqual([
      { id: term1Id, term_number: 1, status: 'completed' },
      { id: renewal.termId, term_number: 2, status: 'active' },
    ]);

    const invoices = await db.prepare(`
      SELECT id, enrollment_term_id, amount, status
      FROM invoices
      WHERE enrollment_term_id IN (?, ?)
      ORDER BY id
    `).bind(term1Id, renewal.termId).all<InvoiceRow>();
    expect(invoices.results).toHaveLength(2);
    expect(invoices.results[0]).toMatchObject({
      id: term1InvoiceId,
      enrollment_term_id: term1Id,
      amount: 800000,
      status: 'pending',
    });
    expect(invoices.results[1]).toMatchObject({
      id: renewal.invoiceId,
      enrollment_term_id: renewal.termId,
      amount: 800000,
      status: 'pending',
    });

    const payment = await db.prepare(`
      SELECT invoice_id, amount FROM payments WHERE invoice_id = ?
    `).bind(term1InvoiceId).first<{ invoice_id: number; amount: number }>();
    expect(payment).toEqual({ invoice_id: term1InvoiceId, amount: 300000 });
  });

  it('concurrent initial term creation resolves to one active term', async () => {
    await db.prepare(`DELETE FROM invoices`).run();
    await db.prepare(`DELETE FROM enrollment_terms`).run();

    const results = await Promise.all([
      import('../../src/server/enrollment-term-service').then(({ ensureActiveEnrollmentTerm }) =>
        ensureActiveEnrollmentTerm(db, {
          enrollmentId: 1,
          startDate: '2026-09-01',
          billingType: 'session_based',
          plannedSessions: 8,
          tuitionAmount: 800000,
          tuitionDueDate: '2026-09-08',
        })),
      import('../../src/server/enrollment-term-service').then(({ ensureActiveEnrollmentTerm }) =>
        ensureActiveEnrollmentTerm(db, {
          enrollmentId: 1,
          startDate: '2026-09-01',
          billingType: 'session_based',
          plannedSessions: 8,
          tuitionAmount: 800000,
          tuitionDueDate: '2026-09-08',
        })),
    ]);

    expect(results[0]).toBe(results[1]);

    const activeTerms = await db.prepare(`
      SELECT id, term_number FROM enrollment_terms
      WHERE enrollment_id = 1 AND status = 'active'
    `).all<{ id: number; term_number: number }>();
    expect(activeTerms.results).toHaveLength(1);
    expect(activeTerms.results[0].id).toBe(results[0]);

    const invoices = await db.prepare(`
      SELECT id, enrollment_term_id FROM invoices
      WHERE enrollment_term_id = ? AND status <> 'cancelled'
    `).bind(results[0]).all<{ id: number; enrollment_term_id: number }>();
    expect(invoices.results).toHaveLength(1);
  });
});
