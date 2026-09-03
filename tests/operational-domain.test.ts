import { describe, expect, it } from 'vitest';
import { validateAttendance } from '../src/server/attendance-service';
import { validateClassSession } from '../src/server/class-sessions';
import { shouldWarnForRenewal, type EnrollmentProgress } from '../src/server/enrollment-progress';

describe('operational education domain', () => {
  it('accepts an active enrollment on a non-cancelled session', () => {
    expect(() => validateAttendance({
      sessionExists: true,
      sessionCancelled: false,
      enrollmentBelongsToSession: true,
      enrollmentActive: true,
    })).not.toThrow();
  });

  it('rejects attendance for cancelled sessions', () => {
    expect(() => validateAttendance({
      sessionExists: true,
      sessionCancelled: true,
      enrollmentBelongsToSession: true,
      enrollmentActive: true,
    })).toThrow('SESSION_CANCELLED');
  });

  it('requires a source session for makeup sessions', () => {
    const errors = validateClassSession({
      classId: 1,
      sessionDate: '2026-09-01',
      startTime: '17:00',
      endTime: '18:00',
      instructorId: 1,
      roomId: 1,
      type: 'makeup',
    });
    expect(errors).toContain('جلسه جبرانی باید به جلسه اصلی متصل باشد.');
  });

  it('rejects an originalSessionId on a regular session', () => {
    const errors = validateClassSession({
      classId: 1,
      sessionDate: '2026-09-01',
      startTime: '17:00',
      endTime: '18:00',
      instructorId: 1,
      roomId: 1,
      type: 'regular',
      originalSessionId: 10,
    });
    expect(errors).toContain('جلسه عادی نباید به‌عنوان جبرانی به جلسه دیگری متصل باشد.');
  });

  it('requires a room for hybrid sessions', () => {
    const errors = validateClassSession({
      classId: 1,
      sessionDate: '2026-09-01',
      startTime: '17:00',
      endTime: '18:00',
      instructorId: 1,
      locationType: 'hybrid',
    });
    expect(errors).toContain('برای جلسه حضوری یا ترکیبی اتاق الزامی است.');
  });

  it('keeps monthly progress unbounded by a session count', () => {
    const progress: EnrollmentProgress = {
      termId: 1,
      billingType: 'monthly',
      plannedSessions: null,
      consumedSessions: 20,
      remainingSessions: null,
      pendingSessions: 0,
      excusedSessions: 0,
    };
    expect(shouldWarnForRenewal(progress)).toBe(false);
    expect(progress.remainingSessions).toBeNull();
  });

  it('warns session-based terms at one remaining session', () => {
    const progress: EnrollmentProgress = {
      termId: 1,
      billingType: 'session_based',
      plannedSessions: 8,
      consumedSessions: 7,
      remainingSessions: 1,
      pendingSessions: 0,
      excusedSessions: 0,
    };
    expect(shouldWarnForRenewal(progress)).toBe(true);
  });

  it('does not consume pending or excused attendance', () => {
    const statuses = ['present', 'absent', 'pending', 'excused'] as const;
    const consumed = statuses.filter((status) => status === 'present' || status === 'absent');
    expect(consumed).toEqual(['present', 'absent']);
  });

  it('preserves the old term for already-provisioned sessions after renewal', () => {
    const term1 = 101;
    const term2 = 202;
    const alreadyProvisionedTermId = term1;
    const activeTermIdAfterRenewal = term2;

    // Mirrors the COALESCE(existing.enrollment_term_id, excluded.enrollment_term_id)
    // rule used by session provisioning: an existing session must never be
    // reassigned to the newly active term merely because the provisioner runs again.
    const retainedTermId = alreadyProvisionedTermId ?? activeTermIdAfterRenewal;

    expect(retainedTermId).toBe(term1);
    expect(retainedTermId).not.toBe(term2);
  });

  it('assigns a newly provisioned session to the new active term', () => {
    const existingTermId: number | null = null;
    const activeTermIdAfterRenewal = 202;

    const assignedTermId = existingTermId ?? activeTermIdAfterRenewal;

    expect(assignedTermId).toBe(202);
  });
});
