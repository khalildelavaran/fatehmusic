import { handle } from "@astrojs/cloudflare/handler";
import { generateDailyPost } from "./server/ai-post-generator";

interface WorkerEnv {
  DB: D1Database;
  AI: Ai;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    ctx.waitUntil(generateDailyPost(env));
  }
};
