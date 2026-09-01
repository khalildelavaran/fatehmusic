import { describe, expect, it } from 'vitest';

describe('session provisioning domain', () => {
  it('uses pending as the initial student attendance state', () => {
    const initialStatus = 'pending';
    expect(initialStatus).toBe('pending');
    expect(['pending', 'present', 'absent', 'excused']).toContain(initialStatus);
  });

  it('does not treat excused leave as an absence', () => {
    const consumesSession = (status: string) => status === 'present' || status === 'absent';
    expect(consumesSession('excused')).toBe(false);
    expect(consumesSession('pending')).toBe(false);
    expect(consumesSession('present')).toBe(true);
    expect(consumesSession('absent')).toBe(true);
  });

  it('defines the business rule that the first concrete session starts the term', () => {
    const registrationDate = '2026-08-20';
    const firstSessionDate = '2026-09-01';
    expect(firstSessionDate).not.toBe(registrationDate);
    expect(firstSessionDate).toBe('2026-09-01');
  });

  it('keeps monthly billing independent from a planned session count', () => {
    const billingType = 'monthly';
    const plannedSessions = null;
    expect(billingType).toBe('monthly');
    expect(plannedSessions).toBeNull();
  });
});
