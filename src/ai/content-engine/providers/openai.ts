// OpenAI / ChatGPT article-writing provider.
// Uses official Chat Completions API with forced function/tool call for reliable JSON extraction.

import type { ArticleGenerationParams, ProviderCallResult, TestConnectionResult } from "./types";
import type { GeneratedArticle } from "../types";
import { DEFAULT_MODELS } from "./models";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const ARTICLE_TOOL = {
  type: "function",
  function: {
    name: "submit_article",
    description: "ثبت نسخه‌ی نهایی مقاله برای وبلاگ آموزشگاه موسیقی فاتح.",
    parameters: {
      type: "object",
      properties: {
        slug: { type: "string", description: "اسلاگ URL با حروف لاتین یا فارسی و خط تیره، بدون فاصله" },
        excerpt: { type: "string", description: "خلاصه دو تا سه جمله‌ای به زبان فارسی" },
        content: { type: "string", description: "متن کامل مقاله به فارسی با پاراگراف‌های جداشده با دو خط جدید" },
        topic: { type: "string", description: "دسته‌بندی موضوعی کوتاه مانند آموزش گیتار" },
        meta_title: { type: "string", description: "عنوان سئو بین ۲۰ تا ۶۰ کاراکتر" },
        meta_description: { type: "string", description: "توضیح متای سئو بین ۸۰ تا ۱۶۰ کاراکتر" }
      },
      required: ["slug", "excerpt", "content", "topic", "meta_title", "meta_description"],
      additionalProperties: false
    }
  }
};

const REQUIRED_FIELDS: (keyof GeneratedArticle)[] = [
  "slug",
  "excerpt",
  "content",
  "topic",
  "meta_title",
  "meta_description"
];

export async function callOpenAIArticle(params: ArticleGenerationParams): Promise<ProviderCallResult> {
  const model = params.model || DEFAULT_MODELS.openai;
  if (!params.apiKey) {
    return {
      success: false,
      provider: "openai",
      model,
      message: "کلید OPENAI_API_KEY تنظیم نشده است. لطفاً آن را در متغیرهای محیطی ثبت کنید."
    };
  }

  const startTime = Date.now();
  let response: Response | null = null;
  const isReasoningModel = model.startsWith("o");

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: isReasoningModel ? "user" : "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt }
    ],
    tools: [ARTICLE_TOOL],
    tool_choice: { type: "function", function: { name: "submit_article" } }
  };

  if (!isReasoningModel) {
    requestBody.max_tokens = params.maxTokens || 4096;
    requestBody.temperature = 0.7;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${params.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
    } catch (err) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      const detail = err instanceof Error ? err.message : String(err);
      return { success: false, provider: "openai", model, message: `اتصال به OpenAI برقرار نشد: ${detail}` };
    }

    if (response.ok || (response.status !== 429 && response.status < 500)) break;

    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  if (!response) {
    return { success: false, provider: "openai", model, message: "پاسخی از سرور OpenAI دریافت نشد." };
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    return {
      success: false,
      provider: "openai",
      model,
      message: `OpenAI خطای HTTP ${response.status} بازگرداند: ${errorBody.slice(0, 300)}`
    };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { success: false, provider: "openai", model, message: "پاسخ OpenAI قابل تجزیه به JSON نبود." };
  }

  const message = data?.choices?.[0]?.message;
  const toolCall = (message?.tool_calls ?? []).find((c: any) => c?.function?.name === "submit_article");

  let parsedInput: Record<string, unknown> | null = null;
  if (toolCall?.function?.arguments) {
    try {
      parsedInput = JSON.parse(toolCall.function.arguments);
    } catch {
      return { success: false, provider: "openai", model, message: "خروجی function call اوپن‌ای‌آی ساختار JSON معتبر نداشت." };
    }
  } else if (message?.content) {
    try {
      const cleanJson = message.content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsedInput = JSON.parse(cleanJson);
    } catch {
      return { success: false, provider: "openai", model, message: "پاسخ متنی OpenAI حاوی ساختار مقاله معتبر نبود." };
    }
  }

  if (!parsedInput) {
    return { success: false, provider: "openai", model, message: "پاسخ ارسالی از OpenAI فاقد فراخوانی تابع یا داده مقاله بود." };
  }

  const missing = REQUIRED_FIELDS.filter(
    (key) => typeof parsedInput![key] !== "string" || (parsedInput![key] as string).trim().length === 0
  );

  if (missing.length > 0) {
    return { success: false, provider: "openai", model, message: `خروجی OpenAI فاقد فیلدهای الزامی است: ${missing.join(", ")}` };
  }

  const article: GeneratedArticle = {
    slug: String(parsedInput.slug).trim(),
    excerpt: String(parsedInput.excerpt).trim(),
    content: String(parsedInput.content).trim(),
    topic: String(parsedInput.topic).trim(),
    meta_title: String(parsedInput.meta_title).trim(),
    meta_description: String(parsedInput.meta_description).trim()
  };

  return {
    success: true,
    article,
    provider: "openai",
    model,
    latencyMs: Date.now() - startTime
  };
}

export async function testOpenAIConnection(apiKey: string, model = DEFAULT_MODELS.openai): Promise<TestConnectionResult> {
  if (!apiKey) {
    return {
      success: false,
      provider: "openai",
      model,
      message: "کلید OPENAI_API_KEY تنظیم نشده است."
    };
  }

  const startTime = Date.now();
  try {
    const isReasoning = model.startsWith("o");
    const payload: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: "سلام، فقط کلمه تایید را بنویس." }]
    };
    if (!isReasoning) {
      payload.max_tokens = 10;
    }

    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return {
        success: false,
        provider: "openai",
        model,
        latencyMs: Date.now() - startTime,
        message: `خطای اتصال OpenAI (${res.status}): ${err.slice(0, 200)}`
      };
    }

    return {
      success: true,
      provider: "openai",
      model,
      latencyMs: Date.now() - startTime,
      message: `اتصال با موفقیت برقرار شد (${Date.now() - startTime}ms).`
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      provider: "openai",
      model,
      latencyMs: Date.now() - startTime,
      message: `خطای شبکه در اتصال به OpenAI: ${detail}`
    };
  }
}
