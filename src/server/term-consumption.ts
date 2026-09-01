export type AttendanceStatus = 'present' | 'absent' | 'excused';

export type TermConsumption = {
  plannedSessions: number | null;
  present: number;
  absent: number;
  excused: number;
  consumedSessions: number;
  remainingSessions: number | null;
};

/** Session consumption is deliberately independent from billing amount. */
export function calculateTermConsumption(
  plannedSessions: number | null,
  statuses: AttendanceStatus[],
): TermConsumption {
  const present = statuses.filter((s) => s === 'present').length;
  const absent = statuses.filter((s) => s === 'absent').length;
  const excused = statuses.filter((s) => s === 'excused').length;
  const consumedSessions = present + absent;

  return {
    plannedSessions,
    present,
    absent,
    excused,
    consumedSessions,
    remainingSessions:
      plannedSessions === null
        ? null
        : Math.max(0, plannedSessions - consumedSessions),
  };
}
