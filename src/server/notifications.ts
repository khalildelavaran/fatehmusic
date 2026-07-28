/*
====================================================
File: src/server/notifications.ts

Purpose:
Sends a "new registration" alert to academy staff. Runs
server-side only (inside the Cloudflare Worker), never in the
browser - this is where the Telegram bot token / email API key
live, so they are never exposed to the client.

Each channel is independent and best-effort: if Telegram isn't
configured yet, it's silently skipped; same for email. Missing
or failing notifications never fail the registration itself -
the D1 write already happened by the time this runs.

Setup:
- Telegram: create a bot via @BotFather, then set the
  TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets
  (wrangler secret put TELEGRAM_BOT_TOKEN, etc).
- Email: sign up at resend.com (or swap sendEmail() below for
  another provider), then set RESEND_API_KEY and NOTIFY_EMAIL.
====================================================
*/

export interface NotificationPayload {
  trackingCode: string;
  instrumentTitle: string;
  instructorName: string;
  scheduleSummary: string;
  studentFirstName: string;
  studentLastName: string;
  studentMobile: string;
  studentAge: number;
}

export interface NotificationEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
}

export interface NotificationResult {
  telegram: boolean;
  email: boolean;
}

export async function sendRegistrationNotifications(
  payload: NotificationPayload,
  env: NotificationEnv
): Promise<NotificationResult> {
  const result: NotificationResult = { telegram: false, email: false };

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await sendTelegram(payload, env as Required<Pick<NotificationEnv, "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID">>);
      result.telegram = true;
    } catch (err) {
      console.error("Telegram notification failed:", err);
    }
  }

  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    try {
      await sendEmail(payload, env as Required<Pick<NotificationEnv, "RESEND_API_KEY" | "NOTIFY_EMAIL">>);
      result.email = true;
    } catch (err) {
      console.error("Email notification failed:", err);
    }
  }

  return result;
}

function buildMessageText(payload: NotificationPayload): string {
  return [
    `ثبت‌نام جدید — کد پیگیری: ${payload.trackingCode}`,
    ``,
    `هنرجو: ${payload.studentFirstName} ${payload.studentLastName} (${payload.studentAge} سال)`,
    `موبایل: ${payload.studentMobile}`,
    `ساز: ${payload.instrumentTitle}`,
    `استاد: ${payload.instructorName}`,
    `زمان کلاس: ${payload.scheduleSummary}`
  ].join("\n");
}

async function sendTelegram(
  payload: NotificationPayload,
  env: { TELEGRAM_BOT_TOKEN: string; TELEGRAM_CHAT_ID: string }
) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: buildMessageText(payload)
    })
  });

  if (!res.ok) {
    throw new Error(`Telegram API responded ${res.status}: ${await res.text()}`);
  }
}

async function sendEmail(payload: NotificationPayload, env: { RESEND_API_KEY: string; NOTIFY_EMAIL: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      // onboarding@resend.dev works immediately with no setup, but only
      // delivers to the email you signed up to Resend with. Once you
      // verify your own domain in the Resend dashboard, change this to
      // something like "ثبت نام <no-reply@fatehmusic.ir>".
      from: "ثبت نام آموزشگاه فاتح <onboarding@resend.dev>",
      to: env.NOTIFY_EMAIL,
      subject: `ثبت‌نام جدید - ${payload.studentFirstName} ${payload.studentLastName}`,
      text: buildMessageText(payload)
    })
  });

  if (!res.ok) {
    throw new Error(`Resend API responded ${res.status}: ${await res.text()}`);
  }
}
