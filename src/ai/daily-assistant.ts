import type { DailySession } from "../server/daily-dashboard";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const VERSION = "2023-06-01";

export type DailyAssistantResult = {
  success: boolean;
  message: string;
};

function compactContext(date: string, sessions: DailySession[]) {
  return {
    date,
    sessions: sessions.map((session) => ({
      id: session.sessionId,
      classId: session.classId,
      class: session.className,
      time: `${session.startTime}-${session.endTime}`,
      instructor: session.instructorName,
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
): Promise<DailyAssistantResult> {
  if (!apiKey) {
    return { success: false, message: "ANTHROPIC_API_KEY برای دستیار روزانه تنظیم نشده است." };
  }

  const system = `تو دستیار هوشمند منشی آموزشگاه موسیقی فاتح هستی.
وظیفه تو کمک به نظم‌دهی کلاس‌ها، زمان هنرجویان، استادها و اتاق‌هاست.
فقط بر اساس داده‌ای که در پیام کاربر و context داده شده پاسخ بده؛ اگر داده کافی نیست صریحاً بگو.
هیچ رزرو، جابه‌جایی، لغو، پرداخت یا تغییر اطلاعات را خودکار انجام نده.
برای پیشنهاد زمان، تداخل استاد/اتاق و وضعیت کلاس‌ها تحلیل عملی و کوتاه ارائه کن.
اگر چند گزینه وجود دارد، آن‌ها را از بهترین به ضعیف‌تر مرتب کن و دلیل هر گزینه را بگو.
پاسخ فارسی، روشن و مناسب منشی باشد. از ساختن اطلاعات یا ساعت‌هایی که در context نیستند خودداری کن.`;

  const userPrompt = `تاریخ کاری: ${date}\n\nداده فعلی داشبورد:\n${JSON.stringify(compactContext(date, sessions), null, 2)}\n\nدرخواست منشی:\n${question.trim()}`;

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
        max_tokens: 1200,
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
