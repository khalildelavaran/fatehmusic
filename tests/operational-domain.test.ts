import { describe, expect, it } from 'vitest';
import { validateAttendance } from '../src/server/attendance-service';
import { validateClassSession } from '../src/server/class-sessions';
import { shouldWarnForRenewal, type EnrollmentProgress } from '../src/server/enrollment-progress';

describe('operational education domain', () => {
  it('allows an explicit four-state student attendance domain', () => {
    expect(() => validateAttendance({ sessionExists:true, sessionCancelled:false, enrollmentBelongsToSession:true, enrollmentActive:true })).not.toThrow();
  });

  it('requires a source session for makeup sessions', () => {
    const errors = validateClassSession({ classId:1, sessionDate:'2026-09-01', startTime:'17:00', endTime:'18:00', instructorId:1, roomId:1, type:'makeup' });
    expect(errors).toContain('جلسه جبرانی باید به جلسه اصلی متصل باشد.');
  });

  it('keeps monthly progress unbounded by a session count', () => {
    const progress: EnrollmentProgress = { termId:1, billingType:'monthly', plannedSessions:null, consumedSessions:20, remainingSessions:null, pendingSessions:0, excusedSessions:0 };
    expect(shouldWarnForRenewal(progress)).toBe(false);
    expect(progress.remainingSessions).toBeNull();
  });

  it('warns session-based terms at one remaining session', () => {
    const progress: EnrollmentProgress = { termId:1, billingType:'session_based', plannedSessions:8, consumedSessions:7, remainingSessions:1, pendingSessions:0, excusedSessions:0 };
    expect(shouldWarnForRenewal(progress)).toBe(true);
  });
});
