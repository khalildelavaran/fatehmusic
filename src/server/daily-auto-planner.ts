import type { DailySession, DailyStudent } from "./daily-dashboard";

export type AutoPlannerStudentChange = {
  enrollmentSessionId: number;
  studentId: number;
  studentName: string;
  sessionId: number;
  from: { startTime: string; endTime: string };
  to: { startTime: string; endTime: string };
};

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
  studentChanges: AutoPlannerStudentChange[];
  questions: AutoPlannerQuestion[];
  summary: string;
};

type Room = { id: number; name: string; capacity: number; status?: string };
type WorkingSession = DailySession & { removed?: boolean };

type StudentSlot = {
  session: WorkingSession;
  student: DailyStudent | null;
  start: number;
  end: number;
  duration: number;
};

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
  return session.students.length > 0 && session.students.every((student) =>
    student.attendanceStatus === "absent" || student.attendanceStatus === "excused"
  );
}

function activeStudents(session: WorkingSession): DailyStudent[] {
  return session.students.filter((student) =>
    student.attendanceStatus !== "absent" &&
    student.attendanceStatus !== "excused"
  );
}

function sessionSlots(session: WorkingSession): StudentSlot[] {
  const students = activeStudents(session);

  if (!students.length) {
    return [{
      session,
      student: null,
      start: minutes(session.startTime),
      end: minutes(session.endTime),
      duration: Math.max(15, minutes(session.endTime) - minutes(session.startTime)),
    }];
  }

  return students.map((student) => {
    const start = minutes(student.startTime || session.startTime);
    const end = minutes(student.endTime || session.endTime);
    return {
      session,
      student,
      start,
      end,
      duration: Math.max(15, end - start),
    };
  });
}

function conflictsWithOtherTeacherOrRoom(
  slot: StudentSlot,
  start: number,
  end: number,
  allSessions: WorkingSession[],
  teacherId: number,
): boolean {
  for (const other of allSessions) {
    if (other.removed || other.sessionId === slot.session.sessionId) continue;
    if (other.instructorId !== teacherId && overlaps(start, end, minutes(other.startTime), minutes(other.endTime))) {
      return true;
    }
    if (
      slot.session.roomId !== null &&
      other.roomId === slot.session.roomId &&
      other.instructorId !== teacherId &&
      overlaps(start, end, minutes(other.startTime), minutes(other.endTime))
    ) {
      return true;
    }
  }
  return false;
}

function studentConflicts(
  slot: StudentSlot,
  start: number,
  end: number,
  allSessions: WorkingSession[],
): boolean {
  if (!slot.student) return false;

  for (const other of allSessions) {
    if (other.removed || other.sessionId === slot.session.sessionId) continue;
    if (!other.students.some((student) =>
      student.studentId === slot.student!.studentId &&
      student.attendanceStatus !== "absent" &&
      student.attendanceStatus !== "excused"
    )) continue;

    for (const otherStudent of activeStudents(other)) {
      if (overlaps(start, end, minutes(otherStudent.startTime || other.startTime), minutes(otherStudent.endTime || other.endTime))) {
        return true;
      }
    }
  }

  return false;
}

function canUseSlot(
  slot: StudentSlot,
  start: number,
  end: number,
  allSessions: WorkingSession[],
): boolean {
  if (start < 8 * 60 || end > 22 * 60) return false;
  if (slot.session.roomId !== null) {
    const roomCapacity = allSessions.find((session) => session.sessionId === slot.session.sessionId)?.students.length ?? 0;
    if (roomCapacity < 0) return false;
  }
  if (conflictsWithOtherTeacherOrRoom(slot, start, end, allSessions, slot.session.instructorId)) return false;
  if (studentConflicts(slot, start, end, allSessions)) return false;
  return true;
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

  const working: WorkingSession[] = sessions.map((session) => ({
    ...session,
    removed: removeIds.has(session.sessionId) || attendanceBlocks(session),
  }));

  const removedSessionIds = working.filter((session) => session.removed).map((session) => session.sessionId);
  const active = working.filter((session) => !session.removed);
  const changes: AutoPlannerChange[] = [];
  const studentChanges: AutoPlannerStudentChange[] = [];
  const questions: AutoPlannerQuestion[] = [];

  // Build one continuous chain per teacher. The chain contains ACTIVE students
  // only; absent/excused students are intentionally removed from the chain.
  const teacherGroups = new Map<number, WorkingSession[]>();
  for (const session of active) {
    const key = Number(session.instructorId);
    if (!teacherGroups.has(key)) teacherGroups.set(key, []);
    teacherGroups.get(key)!.push(session);
  }

  const externalSessions = active;
  const isExternallyBlocked = (
    slot: StudentSlot,
    start: number,
    end: number,
  ): boolean => {
    for (const other of externalSessions) {
      if (other.sessionId === slot.session.sessionId || other.instructorId === slot.session.instructorId) continue;

      // Different teachers may teach simultaneously. Only the same room or
      // the same student creates an external conflict.
      if (
        slot.session.roomId !== null &&
        other.roomId === slot.session.roomId &&
        overlaps(start, end, minutes(other.startTime), minutes(other.endTime))
      ) return true;

      // A student can also have another lesson outside this teacher's chain.
      if (slot.student && other.students.some((student) => student.studentId === slot.student!.studentId)) {
        for (const otherStudent of activeStudents(other)) {
          if (overlaps(
            start,
            end,
            minutes(otherStudent.startTime || other.startTime),
            minutes(otherStudent.endTime || other.endTime),
          )) return true;
        }
      }

      // Keep rooms collision-free between different teachers.
    }
    return false;
  };

  for (const group of teacherGroups.values()) {
    const slots = group
      .flatMap(sessionSlots)
      .sort((a, b) =>
        direction === "backward"
          ? b.end - a.end || b.session.sessionId - a.session.sessionId
          : a.start - b.start || a.session.sessionId - b.session.sessionId
      );

    if (!slots.length) continue;

    const anchor = direction === "backward"
      ? Math.max(...slots.map((slot) => slot.end))
      : Math.min(...slots.map((slot) => slot.start));

    let cursor = anchor;
    const packed = new Map<number, { session: WorkingSession; start: number; end: number }>();

    for (const slot of slots) {
      const desired = direction === "backward"
        ? cursor - slot.duration
        : cursor;

      let chosenStart: number | null = null;

      // Prefer the exact continuous position. If an external reservation blocks
      // it, move only as far as necessary while retaining the requested direction.
      for (let distance = 0; distance <= 14 * 60; distance += 15) {
        const candidate = direction === "forward"
          ? desired + distance
          : desired - distance;
        const end = candidate + slot.duration;

        if (candidate < 8 * 60 || end > 22 * 60) continue;
        if (isExternallyBlocked(slot, candidate, end)) continue;

        chosenStart = candidate;
        break;
      }

      if (chosenStart === null) {
        questions.push({
          type: "unresolved_conflict",
          sessionId: slot.session.sessionId,
          message: `برای «${slot.session.className}» زمان مناسب برای چینش ${direction === "backward" ? "از آخر به اول" : "از اول به آخر"} پیدا نشد؛ تصمیم منشی لازم است.`,
        });
        continue;
      }

      const chosenEnd = chosenStart + slot.duration;

      if (slot.student?.enrollmentSessionId) {
        const fromStart = time(slot.start);
        const fromEnd = time(slot.end);
        const toStart = time(chosenStart);
        const toEnd = time(chosenEnd);

        if (fromStart !== toStart || fromEnd !== toEnd) {
          studentChanges.push({
            enrollmentSessionId: slot.student.enrollmentSessionId,
            studentId: slot.student.studentId,
            studentName: slot.student.studentName,
            sessionId: slot.session.sessionId,
            from: { startTime: fromStart, endTime: fromEnd },
            to: { startTime: toStart, endTime: toEnd },
          });
        }
      }

      const existing = packed.get(slot.session.sessionId);
      if (!existing) {
        packed.set(slot.session.sessionId, {
          session: slot.session,
          start: chosenStart,
          end: chosenEnd,
        });
      } else {
        existing.start = Math.min(existing.start, chosenStart);
        existing.end = Math.max(existing.end, chosenEnd);
      }

      cursor = direction === "backward" ? chosenStart : chosenEnd;
    }

    for (const plan of packed.values()) {
      const original = plan.session;
      const nextStart = time(plan.start);
      const nextEnd = time(plan.end);

      if (nextStart !== original.startTime || nextEnd !== original.endTime) {
        changes.push({
          sessionId: original.sessionId,
          className: original.className,
          instructorName: original.instructorName,
          studentNames: activeStudents(original).map((student) => student.studentName),
          from: {
            startTime: original.startTime,
            endTime: original.endTime,
            roomId: original.roomId,
            roomName: original.roomName,
          },
          to: {
            startTime: nextStart,
            endTime: nextEnd,
            roomId: original.roomId,
            roomName: original.roomName,
          },
          score: 100,
          reasons: [
            direction === "backward" ? "چینش از آخر به اول" : "چینش از اول به آخر",
            "حذف فاصله بین هنرجویان فعال",
            "حذف هنرجوی غایب/مرخصی از زنجیره",
            "حفظ تداخل‌نداشتن استاد، اتاق و برنامه هنرجو",
          ],
        });
      }
    }
  }

  const movedMinutes = studentChanges.reduce(
    (sum, change) => sum + Math.abs(minutes(change.from.startTime) - minutes(change.to.startTime)),
    0,
  );

  const removedNames = working.filter((session) => session.removed).map((session) => session.className);

  const summary = [
    removedNames.length
      ? `${removedNames.length} جلسه به دلیل غیبت/مرخصی از برنامه حذف شد.`
      : "جلسه‌ای برای حذف خودکار وجود ندارد.",
    studentChanges.length || changes.length
      ? `${studentChanges.length} زمان هنرجو و ${changes.length} بازه جلسه برای فشرده‌سازی جابه‌جا می‌شود (${movedMinutes} دقیقه).`
      : "نیازی به جابه‌جایی خودکار تشخیص داده نشد.",
    `جهت چینش: ${direction === "backward" ? "از آخر به اول" : "از اول به آخر"}.`,
    questions.length
      ? `${questions.length} مورد نیازمند تصمیم منشی است.`
      : "تعارض حل‌نشده‌ای باقی نماند.",
  ].join(" ");

  return {
    date,
    direction,
    removedSessionIds,
    changes,
    studentChanges,
    questions,
    summary,
  };
}
