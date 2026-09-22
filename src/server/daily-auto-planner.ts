import type { DailySession } from "./daily-dashboard";

export type AutoPlannerChange = {
  sessionId: number;
  className: string;
  instructorName: string;
  studentNames: string[];
  from: { startTime: string; endTime: string; roomId: number | null; roomName: string | null };
  to: { startTime: string; endTime: string; roomId: number | null; roomName: string | null };
  score: number;
  reasons: string[];
};

export type AutoPlannerQuestion = {
  type: "unresolved_conflict" | "attendance";
  sessionId: number | null;
  message: string;
};

export type DailyAutoPlan = {
  date: string;
  direction: "forward" | "backward";
  removedSessionIds: number[];
  changes: AutoPlannerChange[];
  questions: AutoPlannerQuestion[];
  summary: string;
};

type Room = { id: number; name: string; capacity: number; status?: string };
type HistoricalRow = { student_id: number; start_time: string; room_id: number | null; instructor_id: number };

type WorkingSession = DailySession & { removed?: boolean };

function minutes(value: string): number {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function time(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return bStart < aEnd && bEnd > aStart;
}

function attendanceBlocks(session: DailySession): boolean {
  const students = session.students;
  return students.length > 0 && students.every((student) =>
    student.attendanceStatus === "absent" || student.attendanceStatus === "excused"
  );
}

function historicalTimeScore(target: DailySession, start: number, history: HistoricalRow[]): number {
  const relevant = history.filter((row) => target.students.some((student) => student.studentId === row.student_id));
  if (!relevant.length) return 0;
  const targetHour = start;
  let score = 0;
  for (const row of relevant) {
    const distance = Math.abs(targetHour - minutes(row.start_time));
    score += Math.max(0, 90 - distance);
  }
  return score / relevant.length;
}

function canPlace(
  candidate: WorkingSession,
  start: number,
  room: Room | null,
  placed: WorkingSession[],
  allSessions: WorkingSession[],
): boolean {
  const duration = minutes(candidate.endTime) - minutes(candidate.startTime);
  const end = start + duration;
  if (start < 8 * 60 || end > 22 * 60) return false;

  for (const other of placed) {
    if (other.sessionId === candidate.sessionId || other.removed) continue;
    if (other.instructorId === candidate.instructorId && overlaps(start, end, minutes(other.startTime), minutes(other.endTime))) return false;
    if (room && other.roomId === room.id && overlaps(start, end, minutes(other.startTime), minutes(other.endTime))) return false;
  }

  const studentIds = new Set(candidate.students.map((student) => student.studentId));
  for (const other of allSessions) {
    if (other.sessionId === candidate.sessionId || other.removed) continue;
    if (!other.students.some((student) => studentIds.has(student.studentId))) continue;
    if (overlaps(start, end, minutes(other.startTime), minutes(other.endTime))) return false;
  }
  return !room || room.capacity >= candidate.students.length;
}

export async function buildDailyAutoPlan(
  db: D1Database,
  date: string,
  sessions: DailySession[],
  rooms: Room[],
  options: { removeSessionIds?: number[]; direction?: "forward" | "backward" } = {},
): Promise<DailyAutoPlan> {
  const removeIds = new Set((options.removeSessionIds ?? []).map(Number).filter(Number.isInteger));
  const direction = options.direction === "backward" ? "backward" : "forward";
  const working: WorkingSession[] = sessions.map((session) => ({ ...session, removed: removeIds.has(session.sessionId) || attendanceBlocks(session) }));
  const removedSessionIds = working.filter((session) => session.removed).map((session) => session.sessionId);

  const studentIds = Array.from(new Set(working.flatMap((session) => session.students.map((student) => student.studentId))));
  const history = studentIds.length
    ? (await db.prepare(`
        SELECT DISTINCT e.student_id, cs.start_time, cs.room_id, cs.instructor_id
        FROM enrollment_sessions es
        JOIN enrollments e ON e.id = es.enrollment_id
        JOIN class_sessions cs ON cs.id = es.session_id
        WHERE e.student_id IN (${studentIds.map(() => "?").join(",")})
          AND cs.session_date < ?
          AND cs.status <> 'cancelled'
        ORDER BY cs.session_date DESC
        LIMIT 500
      `).bind(...studentIds, date).all<HistoricalRow>()).results || []
    : [];

  const changes: AutoPlannerChange[] = [];
  const questions: AutoPlannerQuestion[] = [];
  const active = working.filter((session) => !session.removed);
  const roomOptions = rooms.length ? rooms : [null];

  // Compact each teacher's active sessions continuously, while treating each
  // individual student slot as the unit of packing. This removes holes caused by
  // absent/leave students instead of merely moving whole class sessions.
  const placed: WorkingSession[] = [];
  const teacherGroups = new Map<number, WorkingSession[]>();
  for (const session of active) {
    const key = Number(session.instructorId);
    if (!teacherGroups.has(key)) teacherGroups.set(key, []);
    teacherGroups.get(key)!.push(session);
  }

  const groups = [...teacherGroups.values()].sort((a, b) =>
    Math.min(...a.map((x) => minutes(x.startTime))) - Math.min(...b.map((x) => minutes(x.startTime)))
  );

  for (const group of groups) {
    const slots = group.flatMap((session) =>
      session.students.length
        ? session.students.map((student, index) => ({
            session,
            student,
            index,
            start: minutes(student.startTime || session.startTime),
            end: minutes(student.endTime || session.endTime),
          }))
        : [{
            session,
            student: null,
            index: 0,
            start: minutes(session.startTime),
            end: minutes(session.endTime),
          }]
    );

    const ordered = slots.sort((a, b) =>
      direction === "backward"
        ? b.end - a.end || b.session.sessionId - a.session.sessionId || b.index - a.index
        : a.start - b.start || a.session.sessionId - b.session.sessionId || a.index - b.index
    );

    const minStart = Math.min(...ordered.map((x) => x.start));
    const maxEnd = Math.max(...ordered.map((x) => x.end));
    let cursor = direction === "backward" ? maxEnd : minStart;

    const sessionPlans = new Map<number, { session: WorkingSession; start: number; end: number }>();
    for (const slot of ordered) {
      const duration = Math.max(15, slot.end - slot.start);
      const originalStart = slot.start;
      const targetStart = direction === "backward" ? cursor - duration : cursor;
      let bestStart: number | null = null;
      let bestScore = -Infinity;

      const lower = direction === "forward" ? 8 * 60 : originalStart;
      const upper = direction === "forward" ? originalStart : 22 * 60 - duration;
      for (let start = direction === "forward" ? lower : originalStart; direction === "forward" ? start <= upper : start <= upper; start += 15) {
        if (direction === "forward" && start > originalStart) break;
        if (direction === "backward" && start > originalStart) continue;
        const end = start + duration;
        if (end > 22 * 60 || start < 8 * 60) continue;

        const sameStudentConflict = ordered.some((other) =>
          other !== slot &&
          other.student?.studentId &&
          slot.student?.studentId === other.student.studentId &&
          other.session.sessionId !== slot.session.sessionId &&
          overlaps(start, end, other.start, other.end)
        );
        if (sameStudentConflict) continue;

        const teacherConflict = [...sessionPlans.values()].some((plan) =>
          plan.session.instructorId === slot.session.instructorId &&
          overlaps(start, end, plan.start, plan.end)
        );
        if (teacherConflict) continue;

        const room = rooms.find((r) => r.id === slot.session.roomId) ?? null;
        const roomConflict = [...sessionPlans.values()].some((plan) =>
          room && plan.session.roomId === room.id && overlaps(start, end, plan.start, plan.end)
        );
        if (roomConflict) continue;

        const distancePenalty = Math.abs(start - originalStart);
        const compactBonus = Math.max(0, 300 - Math.abs(start - targetStart) * 3);
        const historyBonus = slot.student ? historicalTimeScore(slot.session, start, history) : 0;
        const score = compactBonus + historyBonus - distancePenalty;
        if (score > bestScore) {
          bestScore = score;
          bestStart = start;
        }
      }

      if (bestStart === null) {
        questions.push({
          type: "unresolved_conflict",
          sessionId: slot.session.sessionId,
          message: "برای «" + slot.session.className + "» برای این هنرجو زمان پیوسته و بدون تداخل پیدا نشد؛ تصمیم منشی لازم است.",
        });
        continue;
      }

      const end = bestStart + duration;
      const existing = sessionPlans.get(slot.session.sessionId);
      if (!existing) {
        sessionPlans.set(slot.session.sessionId, { session: slot.session, start: bestStart, end });
      } else {
        existing.start = Math.min(existing.start, bestStart);
        existing.end = Math.max(existing.end, end);
      }
      cursor = direction === "backward" ? bestStart : end;
    }

    for (const plan of sessionPlans.values()) {
      const original = plan.session;
      const nextStart = time(plan.start);
      const nextEnd = time(plan.end);
      if (nextStart !== original.startTime || nextEnd !== original.endTime) {
        changes.push({
          sessionId: original.sessionId,
          className: original.className,
          instructorName: original.instructorName,
          studentNames: original.students.map((student) => student.studentName),
          from: { startTime: original.startTime, endTime: original.endTime, roomId: original.roomId, roomName: original.roomName },
          to: { startTime: nextStart, endTime: nextEnd, roomId: original.roomId, roomName: original.roomName },
          score: 0,
          reasons: [
            direction === "backward" ? "چینش از آخر به اول" : "چینش از اول به آخر",
            "حذف فاصله‌های خالی بین هنرجویان",
            "حفظ تداخل‌نداشتن زمان استاد و اتاق",
          ],
        });
        placed.push({
          ...original,
          startTime: nextStart,
          endTime: nextEnd,
        });
      } else {
        placed.push({ ...original });
      }
    }
  }

  const movedMinutes = changes.reduce((sum, change) => sum + Math.max(0, minutes(change.from.startTime) - minutes(change.to.startTime)), 0);
  const removedNames = working.filter((session) => session.removed).map((session) => session.className);
  const summary = [
    removedNames.length ? `${removedNames.length} جلسه به دلیل غیبت/مرخصی از برنامه روز حذف شد.` : "جلسه‌ای برای حذف خودکار وجود ندارد.",
    changes.length ? `${changes.length} جابه‌جایی برای فشرده‌سازی برنامه پیشنهاد شد (${movedMinutes} دقیقه زمان آزادشده).` : "نیازی به جابه‌جایی خودکار تشخیص داده نشد.",
    `جهت چینش: ${direction === "backward" ? "از آخر به اول" : "از اول به آخر"}.`,
    questions.length ? `${questions.length} مورد نیازمند تصمیم منشی است.` : "تعارض حل‌نشده‌ای باقی نماند.",
  ].join(" ");

  return { date, direction, removedSessionIds, changes, questions, summary };
}
