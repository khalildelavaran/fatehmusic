export type SessionGenerationInput = {
  classId: string;
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  roomId?: string | null;
  deliveryMode: 'in_person' | 'online' | 'hybrid';
  calendarWarning?: 'OFFICIAL_HOLIDAY' | 'CLOSURE' | 'SPECIAL_DAY' | null;
};

export type GeneratedSession = SessionGenerationInput & {
  type: 'regular';
  status: 'scheduled';
  calendarWarning: SessionGenerationInput['calendarWarning'];
};

/**
 * Generates the operational session from a schedule occurrence.
 * Calendar exceptions are warnings only and never change the session status.
 */
export function generateClassSession(input: SessionGenerationInput): GeneratedSession {
  return {
    ...input,
    type: 'regular',
    status: 'scheduled',
    calendarWarning: input.calendarWarning ?? null,
  };
}

export function generateMakeupSession(input: Omit<SessionGenerationInput, 'calendarWarning'> & {
  originalSessionId: string;
}): GeneratedSession & { originalSessionId: string; type: 'makeup' } {
  return {
    ...input,
    type: 'makeup',
    status: 'scheduled',
    calendarWarning: null,
  };
}
