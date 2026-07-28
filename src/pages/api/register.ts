/*
====================================================
File: src/pages/api/register.ts

Purpose:
Server-side registration endpoint. Runs on Cloudflare Workers
(never in the browser). Validates the submission again (never
trust client-side validation alone), writes it to D1, and
notifies academy staff.

Requires:
- A D1 database bound as "DB" in wrangler.jsonc (see MIGRATION.md)
- Optional secrets for notifications (see src/server/notifications.ts)
====================================================
*/

export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { RegistrationState } from "../../scripts/registration/RegistrationStore";
import { registrationValidation } from "../../scripts/registration/RegistrationValidation";
import { sendRegistrationNotifications } from "../../server/notifications";

function generateTrackingCode(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `FM-${year}-${random}`;
}

export const POST: APIRoute = async ({ request }) => {
  let state: RegistrationState;

  try {
    state = await request.json();
  } catch {
    return json({ success: false, errors: ["بدنه‌ی درخواست معتبر نیست."] }, 400);
  }

  const validation = registrationValidation.validate(state);
  if (!validation.valid) {
    return json({ success: false, errors: validation.errors }, 422);
  }

  const db = env.DB;
  if (!db) {
    console.error("D1 binding 'DB' is missing - is wrangler.jsonc configured and did you run the migration?");
    return json({ success: false, errors: ["سرویس ذخیره‌سازی در دسترس نیست. لطفاً بعداً تلاش کنید."] }, 500);
  }

  // A handful of retries covers the astronomically unlikely case of a
  // duplicate 6-digit tracking code in the same year.
  let trackingCode = "";
  let inserted = false;

  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    trackingCode = generateTrackingCode();

    try {
      await db
        .prepare(
          `INSERT INTO registrations (
            tracking_code,
            instrument_id, instrument_title, instrument_slug,
            instructor_id, instructor_name,
            schedule_id, schedule_weekday, schedule_classroom, schedule_duration,
            student_first_name, student_last_name, student_mobile, student_age, student_gender, has_instrument
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(
          trackingCode,
          state.selection.instrument.id,
          state.selection.instrument.title,
          state.selection.instrument.slug,
          state.selection.instructor.id,
          state.selection.instructor.name,
          state.selection.schedule.id,
          state.selection.schedule.weekday,
          state.selection.schedule.classroom,
          state.selection.schedule.sessionDuration,
          state.student.firstName,
          state.student.lastName,
          state.student.mobile,
          state.student.age,
          state.student.gender,
          state.student.hasInstrument
        )
        .run();

      inserted = true;
    } catch (err: any) {
      // SQLite/D1 raises a constraint error for the UNIQUE tracking_code -
      // loop again with a freshly generated code. Any other error is real.
      const isUniqueViolation = String(err?.message ?? "").includes("UNIQUE");
      if (!isUniqueViolation) {
        console.error("D1 insert failed:", err);
        return json({ success: false, errors: ["ذخیره‌سازی ثبت‌نام با خطا مواجه شد."] }, 500);
      }
    }
  }

  if (!inserted) {
    return json({ success: false, errors: ["ذخیره‌سازی ثبت‌نام با خطا مواجه شد."] }, 500);
  }

  const scheduleSummary = [
    state.selection.schedule.weekday,
    state.selection.schedule.sessionDuration ? `${state.selection.schedule.sessionDuration} دقیقه` : null,
    state.selection.schedule.classroom ? `کلاس ${state.selection.schedule.classroom}` : null
  ]
    .filter(Boolean)
    .join(" - ");

  const notified = await sendRegistrationNotifications(
    {
      trackingCode,
      instrumentTitle: state.selection.instrument.title ?? "",
      instructorName: state.selection.instructor.name ?? "",
      scheduleSummary,
      studentFirstName: state.student.firstName,
      studentLastName: state.student.lastName,
      studentMobile: state.student.mobile,
      studentAge: state.student.age ?? 0
    },
    env
  );

  try {
    await db
      .prepare(`UPDATE registrations SET notified_telegram = ?, notified_email = ? WHERE tracking_code = ?`)
      .bind(notified.telegram ? 1 : 0, notified.email ? 1 : 0, trackingCode)
      .run();
  } catch (err) {
    // Notification-status bookkeeping only - the registration itself is
    // already safely stored, so this is logged and swallowed.
    console.error("Failed to record notification status:", err);
  }

  return json({
    success: true,
    trackingCode,
    message: "ثبت نام با موفقیت انجام شد."
  });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
