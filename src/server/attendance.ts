export const ATTENDANCE_STATUSES = ['present', 'absent', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export type AttendanceInput = {
  sessionId: number;
  enrollmentSessionId: number;
  status: AttendanceStatus;
  note?: string | null;
  recordedBy?: number | null;
};

/**
 * Domain validation. Database writes must additionally enforce that:
 * - the ClassSession exists and is not cancelled;
 * - the EnrollmentSession belongs to the ClassSession;
 * - the enrollment is active for the session;
 * - one attendance record exists per enrollment-session/session pair.
 */
export function validateAttendanceInput(input: AttendanceInput): void {
  if (!Number.isInteger(input.sessionId) || input.sessionId <= 0) {
    throw new Error('Invalid sessionId');
  }
  if (!Number.isInteger(input.enrollmentSessionId) || input.enrollmentSessionId <= 0) {
    throw new Error('Invalid enrollmentSessionId');
  }
  if (!isAttendanceStatus(input.status)) {
    throw new Error('Invalid attendance status');
  }
}

export function attendanceConsumesSession(status: AttendanceStatus): boolean {
  return status === 'present' || status === 'absent';
}
