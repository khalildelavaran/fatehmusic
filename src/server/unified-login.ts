import { normalizeNationalCode } from "./student-auth";

/**
 * A 10-digit normalized identifier is treated as a student login
 * attempt (national code), never probed against admin/instructor
 * tables. This must stay in sync with student-auth.ts's own
 * national-code validation (also exactly /^\d{10}$/) since a mismatch
 * here would let a student identifier silently fall through to the
 * admin/instructor lookup instead of failing cleanly.
 */
export function looksLikeNationalCode(identifier: string): boolean {
  return /^\d{10}$/.test(normalizeNationalCode(identifier));
}
