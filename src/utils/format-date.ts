// Shared Jalali (Persian/Shamsi) calendar date formatting.
// Works in both the browser (admin scripts) and Cloudflare Workers SSR
// (Astro frontmatter), since it only relies on the standard Intl API --
// no external calendar-conversion library needed. Node/V8's "fa-IR" locale
// already defaults to the Persian calendar, verified directly:
//   new Intl.DateTimeFormat("fa-IR").resolvedOptions().calendar === "persian"

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** e.g. "۲۵ مرداد ۱۴۰۵" */
export function formatJalaliDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(date);
}

/** e.g. "۲۵ مرداد ۱۴۰۵، ۱۴:۲۲" */
export function formatJalaliDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** e.g. "۱۴:۲۲:۰۵" -- for "last updated" style live indicators */
export function formatJalaliTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("fa-IR", { timeStyle: "medium" }).format(date);
}
