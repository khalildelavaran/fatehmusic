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
  options: { removeSessionIds?: number[] } = {},
): Promise<DailyAutoPlan> {
  const removeIds = new Set((options.removeSessionIds ?? []).map(Number).filter(Number.isInteger));
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

  // First pass: preserve the existing slot whenever it is valid. Sessions are
  // then compacted only when a vacancy exists (typically after a leave/absence).
  const placed: WorkingSession[] = [];
  const ordered = [...active].sort((a, b) => minutes(a.startTime) - minutes(b.startTime) || a.sessionId - b.sessionId);

  for (const session of ordered) {
    const originalStart = minutes(session.startTime);
    const originalEnd = minutes(session.endTime);
    const duration = originalEnd - originalStart;
    if (duration <= 0) {
      questions.push({ type: "unresolved_conflict", sessionId: session.sessionId, message: `مدت کلاس «${session.className}» معتبر نیست.` });
      continue;
    }

    const sameRoom = rooms.find((room) => room.id === session.roomId) ?? null;
    if (canPlace(session, originalStart, sameRoom, placed, active)) {
      placed.push({ ...session });
      continue;
    }

    let best: { start: number; room: Room | null; score: number; reasons: string[] } | null = null;
    for (let start = 8 * 60; start + duration <= 22 * 60; start += 15) {
      // Automatic compaction should never move a class later than its original
      // start; later times remain available for an explicit receptionist decision.
      if (start > originalStart) continue;
      for (const room of roomOptions) {
        if (!canPlace(session, start, room, placed, active)) continue;
        const distancePenalty = Math.abs(start - originalStart);
        const historyBonus = historicalTimeScore(session, start, history);
        const roomBonus = room?.id === session.roomId ? 70 : 0;
        const score = historyBonus + roomBonus - distancePenalty;
        const reasons: string[] = [];
        if (start < originalStart) reasons.push("زمان خالی قبل از کلاس استفاده می‌شود");
        if (room?.id === session.roomId) reasons.push("اتاق قبلی حفظ می‌شود");
        if (historyBonus > 0) reasons.push("با ساعت‌های قبلی هنرجویان سازگارتر است");
        if (!reasons.length) reasons.push("بدون تداخل با استاد، اتاق و هنرجویان");
        if (!best || score > best.score) best = { start, room, score, reasons };
      }
    }

    if (!best) {
      questions.push({
        type: "unresolved_conflict",
        sessionId: session.sessionId,
        message: `برای «${session.className}» پس از بازچینی، زمان آزاد و معتبر پیدا نشد؛ تصمیم منشی لازم است.`,
      });
      placed.push({ ...session });
      continue;
    }

    const nextEnd = best.start + duration;
    changes.push({
      sessionId: session.sessionId,
      className: session.className,
      instructorName: session.instructorName,
      studentNames: session.students.map((student) => student.studentName),
      from: { startTime: session.startTime, endTime: session.endTime, roomId: session.roomId, roomName: session.roomName },
      to: { startTime: time(best.start), endTime: time(nextEnd), roomId: best.room?.id ?? null, roomName: best.room?.name ?? null },
      score: best.score,
      reasons: best.reasons,
    });
    placed.push({
      ...session,
      startTime: time(best.start),
      endTime: time(nextEnd),
      roomId: best.room?.id ?? null,
      roomName: best.room?.name ?? null,
    });
  }

  const movedMinutes = changes.reduce((sum, change) => sum + Math.max(0, minutes(change.from.startTime) - minutes(change.to.startTime)), 0);
  const removedNames = working.filter((session) => session.removed).map((session) => session.className);
  const summary = [
    removedNames.length ? `${removedNames.length} جلسه به دلیل غیبت/مرخصی از برنامه روز حذف شد.` : "جلسه‌ای برای حذف خودکار وجود ندارد.",
    changes.length ? `${changes.length} جابه‌جایی برای فشرده‌سازی برنامه پیشنهاد شد (${movedMinutes} دقیقه زمان آزادشده).` : "نیازی به جابه‌جایی خودکار تشخیص داده نشد.",
    questions.length ? `${questions.length} مورد نیازمند تصمیم منشی است.` : "تعارض حل‌نشده‌ای باقی نماند.",
  ].join(" ");

  return { date, removedSessionIds, changes, questions, summary };
}
