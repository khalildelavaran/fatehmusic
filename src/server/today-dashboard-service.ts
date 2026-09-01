export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'unmarked';

export type TodayStudentCard = {
  enrollmentSessionId: string;
  studentId: string;
  studentName: string;
  attendance: AttendanceStatus;
  consumedSessions: number;
  remainingSessions: number | null;
  tuitionDueDate: string | null;
  tuitionStatus: 'paid' | 'due' | 'overdue' | 'not_applicable';
};

export type TodaySessionCard = {
  sessionId: string;
  classId: string;
  classTitle: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  teacherName: string;
  roomName: string | null;
  deliveryMode: 'in_person' | 'online' | 'hybrid';
  status: 'scheduled' | 'completed' | 'cancelled';
  calendarWarning: 'OFFICIAL_HOLIDAY' | 'CLOSURE' | 'SPECIAL_DAY' | null;
  students: TodayStudentCard[];
};

export const ATTENDANCE_INDICATOR: Record<AttendanceStatus, {
  color: 'green' | 'red' | 'white' | 'yellow';
  label: string;
}> = {
  present: { color: 'green', label: 'حاضر' },
  absent: { color: 'red', label: 'غایب' },
  excused: { color: 'white', label: 'مرخصی' },
  unmarked: { color: 'yellow', label: 'ثبت نشده' },
};

/**
 * Presentation boundary for the secretary's same-day dashboard.
 * Unmarked is intentionally yellow and is not counted as absence.
 */
export function buildTodaySessionCard(input: TodaySessionCard): TodaySessionCard {
  return input;
}
