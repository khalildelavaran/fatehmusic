import { handle } from "@astrojs/cloudflare/handler";
import { runDailyArticleGeneration } from "./ai/content-engine/article-generator";
import { runTopicDiscovery } from "./ai/content-engine/pipeline";
import { runScheduledSearchConsoleSync } from "./seo/v2/providers/search-console-sync.js";
import { generateClassReminders } from "./server/in-app-notifications";

interface WorkerEnv extends Env {
  DB: D1Database;
  AI: Ai;
  ANTHROPIC_API_KEY?: string;
  GSC_CLIENT_EMAIL?: string;
  GSC_PRIVATE_KEY?: string;
  GSC_SITE_URL?: string;
  GSC_SYNC_BREAKDOWNS?: string;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    if (controller.cron === "15 1 * * *" || controller.cron === "15 3 * * *") {
      ctx.waitUntil(runScheduledSearchConsoleSync(env));
      return;
    }

    if (controller.cron === "45 1 * * *") {
      ctx.waitUntil(runTopicDiscovery(env.DB));
      return;
    }

    if (controller.cron === "30 2 * * *") {
      ctx.waitUntil(runDailyArticleGeneration(env));
      return;
    }

    if (controller.cron === "*/30 * * * *") {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const windowStart = new Date(now.getTime() + 30 * 60_000).toISOString().slice(11, 16);
      const windowEnd = new Date(now.getTime() + 90 * 60_000).toISOString().slice(11, 16);
      ctx.waitUntil(generateClassReminders(env.DB, today, windowStart, windowEnd));
    }
  }
};
