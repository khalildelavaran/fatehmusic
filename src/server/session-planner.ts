export type SessionPlanInput = {
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  roomId?: string | null;
  deliveryMode: 'in_person' | 'online' | 'hybrid';
};

export type ScheduleOccurrence = SessionPlanInput & {
  classId: string;
  scheduleId: string;
};

export type CalendarFlag = {
  date: string;
  type: 'OFFICIAL_HOLIDAY' | 'CLOSURE' | 'SPECIAL_DAY';
};

export type SessionPlan = ScheduleOccurrence & {
  kind: 'regular' | 'makeup';
  originalSessionId?: string | null;
  calendarWarning?: CalendarFlag['type'] | null;
};

/**
 * Pure planning layer. Persistence belongs to the repository/service layer.
 * A calendar flag never changes the operational status of a planned session.
 */
export function planRegularSession(
  occurrence: ScheduleOccurrence,
  calendarFlag?: CalendarFlag | null,
): SessionPlan {
  return {
    ...occurrence,
    kind: 'regular',
    originalSessionId: null,
    calendarWarning:
      calendarFlag?.date === occurrence.date ? calendarFlag.type : null,
  };
}

export function planMakeupSession(
  occurrence: ScheduleOccurrence,
  originalSessionId: string,
): SessionPlan {
  return {
    ...occurrence,
    kind: 'makeup',
    originalSessionId,
    calendarWarning: null,
  };
}
