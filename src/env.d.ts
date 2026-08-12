/// <reference types="astro/client" />

declare global {
  interface Env {
    // ===== Bindings =====
    DB: D1Database;

    SESSION: KVNamespace;

    IMAGES: Fetcher;

    ASSETS: Fetcher;

    // ===== Secrets =====
    ADMIN_PASSWORD?: string;
    ADMIN_USERNAME?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    RESEND_API_KEY?: string;
    NOTIFY_EMAIL?: string;
  }

  namespace Cloudflare {
    interface Env {
      DB: D1Database;

      SESSION: KVNamespace;

      IMAGES: Fetcher;

      ASSETS: Fetcher;

      ADMIN_PASSWORD?: string;
      ADMIN_USERNAME?: string;
      TELEGRAM_BOT_TOKEN?: string;
      TELEGRAM_CHAT_ID?: string;
      RESEND_API_KEY?: string;
      NOTIFY_EMAIL?: string;
    }
  }
}

export {};