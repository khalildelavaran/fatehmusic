/*
====================================================
File: src/env.d.ts

Purpose:
Augments the ambient `Env` interface that `wrangler types`
generates from wrangler.jsonc (bindings only: DB, ASSETS) with
the optional notification secrets, which never live in
wrangler.jsonc since they're secrets, not bindings:

  wrangler secret put TELEGRAM_BOT_TOKEN
  wrangler secret put TELEGRAM_CHAT_ID
  wrangler secret put RESEND_API_KEY
  wrangler secret put NOTIFY_EMAIL

Run `wrangler types` after changing wrangler.jsonc to regenerate
worker-configuration.d.ts - it will keep extending this file's
augmentation automatically since both declare the same `Env`
interface (TypeScript merges them).
====================================================
*/

declare global {
  interface Env {
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    RESEND_API_KEY?: string;
    NOTIFY_EMAIL?: string;
  }

  namespace Cloudflare {
    interface Env {
      TELEGRAM_BOT_TOKEN?: string;
      TELEGRAM_CHAT_ID?: string;
      RESEND_API_KEY?: string;
      NOTIFY_EMAIL?: string;
    }
  }
}

export {};
