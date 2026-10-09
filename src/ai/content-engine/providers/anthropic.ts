// Claude (Anthropic Messages API) article-writing provider.
// Uses a FORCED tool call (tool_choice: {type:"tool", name:...}) for guaranteed JSON extraction.

import type { ArticleGenerationParams, ProviderCallResult, TestConnectionResult } from "./types";
import type { GeneratedArticle } from "../types";
import { DEFAULT_MODELS } from "./models";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const ARTICLE_TOOL = {
  name: "submit_article",
  description: "ثبت نسخه‌ی نهایی مقاله برای وبلاگ آموزشگاه موسیقی فاتح.",
  input_schema: {
    type: "object",
    properties: {
      slug: { type: "string", description: "اسلاگ URL با حروف فارسی یا لاتین و خط تیره، بدون فاصله" },
      excerpt: { type: "string", description: "خلاصه‌ی دو تا سه جمله‌ای فارسی" },
      content: { type: "string", description: "متن کامل مقاله به فارسی، پاراگراف‌ها با دو خط جدید (\\n\\n) از هم جدا شده" },
      topic: { type: "string", description: "دسته‌بندی کوتاه فارسی، مثلا: آموزش گیتار" },
      meta_title: { type: "string", description: "عنوان سئو، بین ۲۰ تا ۶۰ کاراکتر" },
      meta_description: { type: "string", description: "توضیح متای سئو، بین ۸۰ تا ۱۶۰ کاراکتر" }
    },
    required: ["slug", "excerpt", "content", "topic", "meta_title", "meta_description"]
  }
};

export type ClaudeArticle = GeneratedArticle;

export interface ClaudeCallResult {
  success: true;
  article: ClaudeArticle;
}
export interface ClaudeCallError {
  success: false;
  message: string;
}

export async function callAnthropicArticle(params: ArticleGenerationParams): Promise<ProviderCallResult> {
  const model = params.model || DEFAULT_MODELS.claude;
  if (!params.apiKey) {
    return {
      success: false,
      provider: "claude",
      model,
      message: "ANTHROPIC_API_KEY تنظیم نشده است. آن را در متغیرهای محیطی یا Cloudflare Secret اضافه کنید."
    };
  }

  const startTime = Date.now();
  let response: Response | null = null;
  const requestBody = {
    model,
    max_tokens: params.maxTokens || 8192,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userPrompt }],
    tools: [ARTICLE_TOOL],
    tool_choice: { type: "tool", name: "submit_article" }
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": params.apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify(requestBody)
      });
    } catch (err) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      const detail = err instanceof Error ? err.message : String(err);
      return { success: false, provider: "claude", model, message: `اتصال به Anthropic برقرار نشد: ${detail}` };
    }

    if (response.ok || (response.status !== 429 && response.status < 500)) break;

    if (attempt === 0) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter)
        ? Math.min(3000, Math.max(500, retryAfter * 1000))
        : 750;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (!response) {
    return { success: false, provider: "claude", model, message: "پاسخ قابل دریافت از Anthropic نبود." };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    return {
      success: false,
      provider: "claude",
      model,
      message: `Anthropic خطای HTTP ${response.status} برگرداند: ${bodyText.slice(0, 300)}`
    };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { success: false, provider: "claude", model, message: "پاسخ Anthropic قابل parse به JSON نبود." };
  }

  const toolBlock = (data?.content ?? []).find((block: any) => block?.type === "tool_use");
  if (!toolBlock) {
    return {
      success: false,
      provider: "claude",
      model,
      message: `پاسخ Anthropic فاقد tool_use بود (stop_reason: ${data?.stop_reason ?? "نامشخص"}).`
    };
  }

  const input = toolBlock.input as Partial<ClaudeArticle> | undefined;
  const missing = ["slug", "excerpt", "content", "topic", "meta_title", "meta_description"].filter(
    (key) => !input || typeof (input as any)[key] !== "string" || (input as any)[key].length === 0
  );
  if (!input || missing.length > 0) {
    return { success: false, provider: "claude", model, message: `خروجی Claude فیلدهای الزامی رو نداشت: ${missing.join(", ")}` };
  }

  return {
    success: true,
    article: input as ClaudeArticle,
    provider: "claude",
    model,
    latencyMs: Date.now() - startTime
  };
}

// Backward compatible helper
export async function callClaudeArticle(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8192,
  model = DEFAULT_MODELS.claude
): Promise<ClaudeCallResult | ClaudeCallError> {
  const result = await callAnthropicArticle({ apiKey, systemPrompt, userPrompt, maxTokens, model });
  if (result.success) {
    return { success: true, article: result.article };
  }
  return { success: false, message: result.message };
}

export async function testAnthropicConnection(apiKey: string, model = DEFAULT_MODELS.claude): Promise<TestConnectionResult> {
  if (!apiKey) {
    return {
      success: false,
      provider: "claude",
      model,
      message: "کلید ANTHROPIC_API_KEY تنظیم نشده است."
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: "user", content: "سلام" }]
      })
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return {
        success: false,
        provider: "claude",
        model,
        latencyMs: Date.now() - startTime,
        message: `خطای اتصال Anthropic (${res.status}): ${err.slice(0, 200)}`
      };
    }

    return {
      success: true,
      provider: "claude",
      model,
      latencyMs: Date.now() - startTime,
      message: `اتصال با موفقیت برقرار شد (${Date.now() - startTime}ms).`
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      provider: "claude",
      model,
      latencyMs: Date.now() - startTime,
      message: `خطای شبکه در اتصال به Anthropic: ${detail}`
    };
  }
}
