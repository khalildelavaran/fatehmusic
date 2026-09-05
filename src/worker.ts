import { handle } from "@astrojs/cloudflare/handler";
import { runDailyArticleGeneration } from "./ai/content-engine/article-generator";
import { generateClassReminders } from "./server/in-app-notifications";

interface WorkerEnv {
  DB: D1Database;
  AI: Ai;
  ANTHROPIC_API_KEY?: string;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    if (controller.cron === "30 2 * * *") {
      ctx.waitUntil(runDailyArticleGeneration(env));
      return;
    }
    if (controller.cron === "*/30 * * * *") {
      // Class reminders (spec section 37): reminds students/instructors of
      // any session starting in the next 30-90 minutes. The window is
      // wider than the 30-minute run interval so a slow/delayed
      // invocation never silently skips a session; generateClassReminders
      // is idempotent per (session, recipient), so overlap is harmless.
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const windowStart = new Date(now.getTime() + 30 * 60_000).toISOString().slice(11, 16);
      const windowEnd = new Date(now.getTime() + 90 * 60_000).toISOString().slice(11, 16);
      ctx.waitUntil(generateClassReminders(env.DB, today, windowStart, windowEnd));
      return;
    }
  }
};
