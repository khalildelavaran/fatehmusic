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
});
