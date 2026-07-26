/*
====================================================
File: src/scripts/registration/RegistrationUtils.ts

Purpose:
Small, pure formatting/parsing helpers shared across the
registration Store / Controller / Renderer / Validation layers.

Architecture:
- Pure functions only, no DOM access, no state
====================================================
*/

import { pricing } from "../../data/pricing";

/** Looks up the pricing plan for a course slug, if one exists. */
export function getPricingPlan(slug: string | null | undefined) {
  if (!slug) return null;
  const planKey = (pricing.coursePricingMap as Record<string, string | undefined>)[slug];
  if (!planKey) return null;
  return (pricing.plans as Record<string, typeof pricing.plans.standard | undefined>)[planKey] ?? null;
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Converts Persian/Arabic-Indic digits in a string to plain ASCII digits. */
export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex !== -1) return String(persianIndex);
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(char);
    if (arabicIndex !== -1) return String(arabicIndex);
    return char;
  });
}

/** Converts ASCII digits in a string/number to Persian digits for display. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/** Normalizes a raw mobile input (Persian digits, spaces, dashes) to digits-only. */
export function normalizeMobile(raw: string): string {
  return toEnglishDigits(raw).replace(/\D/g, "");
}

/** Validates an Iranian mobile number (09xxxxxxxxx). */
export function isValidMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizeMobile(raw));
}

/** Formats an integer amount (assumed Toman) with Persian digits and thousands separators. */
export function formatToman(amount: number): string {
  const withSeparators = Math.round(amount).toLocaleString("en-US");
  return `${toPersianDigits(withSeparators)} تومان`;
}

/** Formats a normalized 11-digit mobile number as 0933-313-9319 for display. */
export function formatMobileDisplay(digits: string): string {
  const normalized = normalizeMobile(digits);
  if (normalized.length !== 11) return digits;
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 7)}-${normalized.slice(7)}`;
}

const WEEKDAY_ORDER = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه"
];

/** Sorts schedule-like records into standard Iranian week order (Saturday first). */
export function sortByWeekday<T extends { weekday: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday)
  );
}

/** Human label for a schedule's class mode. */
export function classModeLabel(mode: string | null | undefined): string {
  if (mode === "private") return "خصوصی";
  if (mode === "group") return "گروهی";
  return "-";
}

/** Escapes text before it is interpolated into an HTML template string. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
