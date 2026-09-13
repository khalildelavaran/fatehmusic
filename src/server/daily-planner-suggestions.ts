export type PlannerCandidate = {
  startTime: string;
  endTime: string;
  roomId: number | null;
  roomName: string | null;
  score: number;
  reasons: string[];
};

type SessionRow = {
  id: number;
  class_id: number;
  class_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  instructor_id: number;
  instructor_name: string;
  room_id: number | null;
  room_name: string | null;
  status: string;
};

type StudentRow = { student_id: number };
type RoomRow = { id: number; name: string; capacity: number };

function minutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function time(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return bStart < aEnd && bEnd > aStart;
}

function parsePositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function getDailyPlannerSuggestions(
  db: D1Database,
  sessionId: number,
  limit = 8,
): Promise<{ session: SessionRow; candidates: PlannerCandidate[] }> {
  const session = await db.prepare(`
    SELECT cs.id, cs.class_id, c.name AS class_name, cs.session_date,
           cs.start_time, cs.end_time, cs.instructor_id,
           COALESCE(i.name, 'مدرس') AS instructor_name,
           cs.room_id, r.name AS room_name, cs.status
    FROM class_sessions cs
    JOIN classes c ON c.id = cs.class_id
    JOIN instructors i ON i.id = cs.instructor_id
    LEFT JOIN rooms r ON r.id = cs.room_id
    WHERE cs.id = ? LIMIT 1
  `).bind(sessionId).first<SessionRow>();

  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status === "cancelled") throw new Error("SESSION_CANCELLED");

  const students = await db.prepare(`
    SELECT DISTINCT e.student_id
    FROM enrollment_sessions es
    JOIN enrollments e ON e.id = es.enrollment_id
    WHERE es.session_id = ? AND e.status = 'active'
  `).bind(sessionId).all<StudentRow>();
  const studentIds = (students.results || []).map((row) => Number(row.student_id)).filter(Number.isInteger);

  const [sessionsResult, roomsResult] = await Promise.all([
    db.prepare(`
      SELECT cs.id, cs.class_id, c.name AS class_name, cs.session_date,
             cs.start_time, cs.end_time, cs.instructor_id,
             COALESCE(i.name, 'مدرس') AS instructor_name,
             cs.room_id, r.name AS room_name, cs.status
      FROM class_sessions cs
      JOIN classes c ON c.id = cs.class_id
      JOIN instructors i ON i.id = cs.instructor_id
      LEFT JOIN rooms r ON r.id = cs.room_id
      WHERE cs.session_date = ? AND cs.status <> 'cancelled'
    `).bind(session.session_date).all<SessionRow>(),
    db.prepare(`
      SELECT id, name, capacity FROM rooms WHERE status = 'active' ORDER BY id
    `).all<RoomRow>(),
  ]);

  const sessions = sessionsResult.results || [];
  const rooms = roomsResult.results || [];
  const duration = minutes(session.end_time) - minutes(session.start_time);
  if (duration <= 0) throw new Error("INVALID_SESSION_DURATION");

  const studentSessions = studentIds.length
    ? await db.prepare(`
        SELECT DISTINCT cs.id, cs.start_time, cs.end_time
        FROM enrollment_sessions es
        JOIN enrollments e ON e.id = es.enrollment_id
        JOIN class_sessions cs ON cs.id = es.session_id
        WHERE e.student_id IN (${studentIds.map(() => "?").join(",")})
          AND cs.session_date = ?
          AND cs.status <> 'cancelled'
          AND cs.id <> ?
      `).bind(...studentIds, session.session_date, sessionId).all<{ id: number; start_time: string; end_time: string }>()
    : { results: [] as { id: number; start_time: string; end_time: string }[] };

  const candidates: PlannerCandidate[] = [];
  const originalStart = minutes(session.start_time);
  const originalRoomId = session.room_id;
  const MIN_DAY = 8 * 60;
  const MAX_DAY = 22 * 60;
  const roomOptions: Array<RoomRow | null> = rooms.length ? rooms : [null];
  const step = 15;

  for (let start = MIN_DAY; start + duration <= MAX_DAY; start += step) {
    const end = start + duration;
    if (start === originalStart) continue;

    const instructorBusy = sessions.some((other) => (
      other.id !== sessionId && other.instructor_id === session.instructor_id
      && overlaps(start, end, minutes(other.start_time), minutes(other.end_time))
    ));
    if (instructorBusy) continue;

    const studentBusy = studentSessions.results.some((other) => (
      overlaps(start, end, minutes(other.start_time), minutes(other.end_time))
    ));
    if (studentBusy) continue;

    for (const room of roomOptions) {
      if (room) {
        if (room.capacity < studentIds.length) continue;
        const roomBusy = sessions.some((other) => (
          other.id !== sessionId && other.room_id === room.id
          && overlaps(start, end, minutes(other.start_time), minutes(other.end_time))
        ));
        if (roomBusy) continue;
      }

      const distance = Math.abs(start - originalStart);
      const sameRoom = room?.id === originalRoomId || (room === null && originalRoomId === null);
      let score = distance;
      const reasons: string[] = ["مدرس آزاد است", "هنرجویان این جلسه تداخل ندارند"];
      if (sameRoom) {
        score -= 45;
        reasons.push("همان اتاق حفظ می‌شود");
      } else if (room) {
        reasons.push(`اتاق ${room.name} آزاد و دارای ظرفیت کافی است`);
      } else {
        reasons.push("بدون اتاق");
      }

      candidates.push({
        startTime: time(start),
        endTime: time(end),
        roomId: room?.id ?? null,
        roomName: room?.name ?? null,
        score,
        reasons,
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score || a.startTime.localeCompare(b.startTime));
  const unique = new Map<string, PlannerCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.startTime}|${candidate.endTime}|${candidate.roomId ?? "none"}`;
    if (!unique.has(key)) unique.set(key, candidate);
  }

  return { session, candidates: Array.from(unique.values()).slice(0, Math.max(1, Math.min(12, limit))) };
}

export function parsePlannerSessionId(value: unknown): number | null {
  return parsePositiveInt(value);
}
