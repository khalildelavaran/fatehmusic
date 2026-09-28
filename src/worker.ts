import { handle } from "@astrojs/cloudflare/handler";
import { runDailyArticleGeneration } from "./ai/content-engine/article-generator";
import { runTopicDiscovery } from "./ai/content-engine/pipeline";
import { runScheduledSearchConsoleSync } from "./seo/v2/providers/search-console-sync.js";
import { runScheduledAhrefsMarketIntelligence } from "./seo/v2/providers/ahrefs.js";
import { generateClassReminders } from "./server/in-app-notifications";

interface WorkerEnv extends Env {
  DB: D1Database;
  AI: Ai;
  ANTHROPIC_API_KEY?: string;
  GSC_CLIENT_EMAIL?: string;
  GSC_PRIVATE_KEY?: string;
  GSC_SITE_URL?: string;
  GSC_SYNC_BREAKDOWNS?: string;
  AHREFS_API_KEY?: string;
  AHREFS_COUNTRY?: string;
  AHREFS_TARGET_URL?: string;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    if (controller.cron === "45 0 * * 0") {
      ctx.waitUntil((async () => {
        try {
          const result = await runScheduledAhrefsMarketIntelligence(env);
          console.log("Scheduled Ahrefs market intelligence:", result.status);
        } catch (error) {
          console.error("Scheduled Ahrefs market intelligence failed; keeping previous snapshot:", error);
        }
      })());
      return;
    }
    if (controller.cron === "15 1 * * *") {
      // Search Console runs in its own invocation so its D1 query budget is not
      // shared with Topic Discovery on Workers Free.
      ctx.waitUntil((async () => {
        try {
          const gscResult = await runScheduledSearchConsoleSync(env);
          console.log("Scheduled GSC sync:", gscResult.status);
        } catch (error) {
          console.error("Scheduled GSC sync failed; keeping the last successful snapshot:", error);
        }
      })());
      return;
    }

    if (controller.cron === "45 1 * * *") {
      // Run after the GSC window so discovery normally consumes the fresh data,
      // while still remaining independent when Search Console is unavailable.
      ctx.waitUntil((async () => {
        try {
          const discoveryResult = await runTopicDiscovery(env.DB, { env });
          console.log("Scheduled topic discovery:", discoveryResult.status);
        } catch (error) {
          console.error("Scheduled topic discovery failed:", error);
        }
      })());
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
