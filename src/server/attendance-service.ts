export type AttendanceStatus = 'pending' | 'present' | 'absent' | 'excused';

export type AttendanceRecord = {
  enrollmentSessionId: string;
  status: AttendanceStatus;
  note?: string | null;
  recordedAt: string;
};

export type AttendanceContext = {
  sessionExists: boolean;
  sessionCancelled: boolean;
  enrollmentBelongsToSession: boolean;
  enrollmentActive: boolean;
};

export function validateAttendance(context: AttendanceContext): void {
  if (!context.sessionExists) throw new Error('SESSION_NOT_FOUND');
  if (context.sessionCancelled) throw new Error('SESSION_CANCELLED');
  if (!context.enrollmentBelongsToSession) throw new Error('ENROLLMENT_NOT_IN_SESSION');
  if (!context.enrollmentActive) throw new Error('ENROLLMENT_INACTIVE');
}

export function upsertAttendance(
  context: AttendanceContext,
  current: AttendanceRecord | null,
  nextStatus: AttendanceStatus,
  now = new Date().toISOString(),
): AttendanceRecord {
  validateAttendance(context);
  return {
    enrollmentSessionId: current?.enrollmentSessionId ?? '',
    status: nextStatus,
    note: current?.note ?? null,
    recordedAt: now,
  };
}
