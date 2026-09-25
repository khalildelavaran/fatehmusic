/// <reference types="astro/client" />

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: Window["fbq"];
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    __fatehGA?: boolean;
  }

  interface Env {
    // ===== Bindings =====
    DB: D1Database;

    SESSION: KVNamespace;

    IMAGES: Fetcher;

    ASSETS: Fetcher;

    // ===== Secrets =====
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

      TELEGRAM_BOT_TOKEN?: string;
      TELEGRAM_CHAT_ID?: string;
      RESEND_API_KEY?: string;
      NOTIFY_EMAIL?: string;
    }
  }
}

export {};