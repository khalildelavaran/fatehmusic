import { handle } from "@astrojs/cloudflare/handler";
import { runDailyArticleGeneration } from "./ai/content-engine/article-generator";

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
    ctx.waitUntil(runDailyArticleGeneration(env));
  }
};
