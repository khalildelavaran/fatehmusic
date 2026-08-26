import { describe, expect, it } from "vitest";
import { getCurrentJalaliYear } from "./format-date";

describe("getCurrentJalaliYear", () => {
  it("returns a plain number in a sane Jalali year range", () => {
    const year = getCurrentJalaliYear();
    expect(typeof year).toBe("number");
    expect(Number.isInteger(year)).toBe(true);
    // Sanity bound rather than a hardcoded year, so this test doesn't go
    // stale -- Jalali years in this range cover roughly 1990-2100 CE.
    expect(year).toBeGreaterThan(1370);
    expect(year).toBeLessThan(1480);
  });

  it("is roughly (Gregorian year - 621), the well-known approximate offset", () => {
    const gregorianYear = new Date().getFullYear();
    const year = getCurrentJalaliYear();
    expect(Math.abs(year - (gregorianYear - 621))).toBeLessThanOrEqual(1);
  });
});
