export type CalendarExceptionType = 'OFFICIAL_HOLIDAY' | 'CLOSURE' | 'SPECIAL_DAY';

export interface CalendarException {
  id: string;
  date: string;
  type: CalendarExceptionType;
  title: string;
  appliesToAllClasses: boolean;
  notes?: string | null;
}

/**
 * Calendar exceptions are advisory only.
 * They must never implicitly cancel a ClassSession.
 * The ClassSession status remains the source of truth for whether a class runs.
 */
export function isCalendarExceptionApplicable(
  exception: CalendarException,
  sessionDate: string,
): boolean {
  return exception.date === sessionDate && exception.appliesToAllClasses;
}

export function getSessionCalendarWarning(
  exceptions: CalendarException[],
  sessionDate: string,
): CalendarException | null {
  return exceptions.find((exception) =>
    isCalendarExceptionApplicable(exception, sessionDate),
  ) ?? null;
}
