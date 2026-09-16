const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function isDailyClosed(db: D1Database, date: string): Promise<boolean> {
  if (!DATE_RE.test(date)) return false;
  const row = await db
    .prepare("SELECT 1 AS closed FROM daily_closures WHERE close_date = ? LIMIT 1")
    .bind(date)
    .first<{ closed: number }>();
  return Boolean(row?.closed);
}

export async function rejectIfDailyClosed(
  db: D1Database,
  date: string,
): Promise<Response | null> {
  if (!(await isDailyClosed(db, date))) return null;
  return new Response(JSON.stringify({
    success: false,
    code: "DAILY_CLOSED",
    message: "این روز بسته شده است و تغییرات عملیاتی جدید برای آن مجاز نیست.",
    date,
  }), {
    status: 409,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * A mutation can affect both a source day and a destination day. Check every
 * affected day instead of trusting only the date supplied by the browser.
 */
export async function rejectIfAnyDailyClosed(
  db: D1Database,
  dates: Array<string | null | undefined>,
): Promise<Response | null> {
  const uniqueDates = [...new Set(dates.filter((date): date is string => Boolean(date)))];
  for (const date of uniqueDates) {
    const closed = await rejectIfDailyClosed(db, date);
    if (closed) return closed;
  }
  return null;
}
