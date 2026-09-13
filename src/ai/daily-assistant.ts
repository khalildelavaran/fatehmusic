import type { DailySession } from "../server/daily-dashboard";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const VERSION = "2023-06-01";

export type DailyAssistantResult = {
  success: boolean;
  message: string;
};

type RoomLike = { id: number; name: string; capacity: number; status: string };

function minutes(value: string): number {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
}

function overlaps(a: DailySession, b: DailySession): boolean {
  return a.sessionId !== b.sessionId
    && a.status !== "cancelled"
    && b.status !== "cancelled"
    && minutes(a.startTime) < minutes(b.endTime)
    && minutes(b.startTime) < minutes(a.endTime);
}

function compactContext(date: string, sessions: DailySession[], rooms: RoomLike[]) {
  const active = sessions.filter((s) => s.status !== "cancelled");
  const conflicts = active.flatMap((session) => active
    .filter((other) => other.sessionId > session.sessionId && overlaps(session, other))
    .map((other) => ({
      firstSessionId: session.sessionId,
      firstClass: session.className,
      firstInstructor: session.instructorName,
      firstRoom: session.roomName,
      firstTime: `${session.startTime}-${session.endTime}`,
      secondSessionId: other.sessionId,
      secondClass: other.className,
      secondInstructor: other.instructorName,
      secondRoom: other.roomName,
      secondTime: `${other.startTime}-${other.endTime}`,
      instructorConflict: session.instructorId === other.instructorId,
      roomConflict: session.roomId != null && session.roomId === other.roomId,
    })));

  return {
    date,
    rooms: rooms.map((room) => ({ id: room.id, name: room.name, capacity: room.capacity })),
    conflicts,
    sessions: sessions.map((session) => ({
      id: session.sessionId,
      classId: session.classId,
      class: session.className,
      time: `${session.startTime}-${session.endTime}`,
      instructorId: session.instructorId,
      instructor: session.instructorName,
      roomId: session.roomId,
      room: session.roomName ?? "بدون اتاق",
      status: session.status,
      type: session.type,
      students: session.students.map((student) => ({
        name: student.studentName,
        attendance: student.attendanceStatus ?? "pending",
        remainingSessions: student.progress?.remainingSessions ?? null,
        pendingSessions: student.progress?.pendingSessions ?? null,
        excusedSessions: student.progress?.excusedSessions ?? null,
      })),
    })),
  };
}

export async function askDailyAssistant(
  apiKey: string | undefined,
  date: string,
  sessions: DailySession[],
  question: string,
  rooms: RoomLike[] = [],
): Promise<DailyAssistantResult> {
  if (!apiKey) {
    return { success: false, message: "ANTHROPIC_API_KEY برای دستیار روزانه تنظیم نشده است." };
  }

  const system = `تو دستیار هوشمند عملیاتی منشی آموزشگاه موسیقی فاتح هستی.
وظیفه تو کمک به نظم‌دهی کلاس‌ها، زمان هنرجویان، استادها و اتاق‌هاست.
داده‌های context منبع حقیقت هستند و نباید اطلاعات، استاد، اتاق یا ساعت ساختگی تولید کنی.
اگر کاربر درباره جابه‌جایی یا زمان جایگزین سؤال کرد، فقط گزینه‌هایی را پیشنهاد کن که با داده‌های موجود سازگار باشند و صریحاً بگو برای رزرو نهایی نیاز به تأیید منشی است.
اگر تداخل استاد یا اتاق وجود دارد، آن را واضح و جداگانه اعلام کن.
اگر اطلاعات لازم برای تصمیم قطعی موجود نیست، سؤال کوتاه و مشخص بپرس یا محدودیت را اعلام کن.
هیچ رزرو، جابه‌جایی، لغو، پرداخت یا تغییر اطلاعات را خودکار انجام نده.
پاسخ فارسی، عملیاتی، کوتاه و مناسب منشی باشد. برای چند گزینه، بهترین گزینه را اول بیاور و دلیل آن را بنویس.`;

  const userPrompt = `تاریخ کاری: ${date}\n\nداده فعلی برنامه:\n${JSON.stringify(compactContext(date, sessions, rooms), null, 2)}\n\nدرخواست منشی:\n${question.trim()}`;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1400,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { success: false, message: `خطای سرویس هوش مصنوعی (${response.status}): ${body.slice(0, 240)}` };
    }

    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) return { success: false, message: "پاسخ قابل استفاده‌ای از دستیار هوشمند دریافت نشد." };
    return { success: true, message: text };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { success: false, message: `ارتباط با دستیار هوشمند برقرار نشد: ${detail}` };
  }
}
