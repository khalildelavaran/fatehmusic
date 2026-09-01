export type TodayStudentCard = {
  enrollmentSessionId: string;
  studentId: string;
  studentName: string;
  attendance: 'present' | 'absent' | 'excused' | 'unmarked';
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

/**
 * Presentation boundary for the secretary's same-day dashboard.
 * Data access and SQL aggregation belong in the repository layer.
 */
export function buildTodaySessionCard(input: TodaySessionCard): TodaySessionCard {
  return input;
}
