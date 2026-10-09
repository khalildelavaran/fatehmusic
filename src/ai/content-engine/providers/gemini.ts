// Google Gemini article provider (Default system provider).
// Uses official @google/genai SDK with structured JSON output and timeout/retry handling.

import { GoogleGenAI, Type } from "@google/genai";
import type { ArticleGenerationParams, ProviderCallResult, TestConnectionResult } from "./types";
import type { GeneratedArticle } from "../types";
import { DEFAULT_MODELS } from "./models";

const REQUIRED_FIELDS: (keyof GeneratedArticle)[] = [
  "slug",
  "excerpt",
  "content",
  "topic",
  "meta_title",
  "meta_description"
];

export async function callGeminiArticle(params: ArticleGenerationParams): Promise<ProviderCallResult> {
  const model = params.model || DEFAULT_MODELS.gemini;
  if (!params.apiKey) {
    return {
      success: false,
      provider: "gemini",
      model,
      message: "کلید GEMINI_API_KEY تنظیم نشده است. لطفاً آن را در متغیرهای محیطی ثبت کنید."
    };
  }

  const startTime = Date.now();
  let lastError = "";

  // Retry loop (up to 2 attempts)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const ai = new GoogleGenAI({ apiKey: params.apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: params.userPrompt,
        config: {
          systemInstruction: params.systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              slug: { type: Type.STRING, description: "اسلاگ URL با حروف لاتین یا فارسی و خط تیره، بدون فاصله" },
              excerpt: { type: Type.STRING, description: "خلاصه دو تا سه جمله‌ای به زبان فارسی" },
              content: { type: Type.STRING, description: "متن کامل مقاله به فارسی با پاراگراف‌های جداشده با دو خط جدید" },
              topic: { type: Type.STRING, description: "دسته‌بندی موضوعی کوتاه مانند آموزش گیتار" },
              meta_title: { type: Type.STRING, description: "عنوان سئو بین ۲۰ تا ۶۰ کاراکتر" },
              meta_description: { type: Type.STRING, description: "توضیح متای سئو بین ۸۰ تا ۱۶۰ کاراکتر" }
            },
            required: ["slug", "excerpt", "content", "topic", "meta_title", "meta_description"]
          }
        }
      });

      const text = response.text?.trim() || "";
      if (!text) {
        lastError = "پاسخ متنی دریافتی از Gemini خالی بود.";
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Strip markdown code fences if any leaked
        const cleanJson = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        parsed = JSON.parse(cleanJson);
      }

      const missing = REQUIRED_FIELDS.filter(
        (key) => typeof parsed[key] !== "string" || (parsed[key] as string).trim().length === 0
      );

      if (missing.length > 0) {
        lastError = `خروجی Gemini فاقد فیلدهای الزامی است: ${missing.join(", ")}`;
        continue;
      }

      const article: GeneratedArticle = {
        slug: String(parsed.slug).trim(),
        excerpt: String(parsed.excerpt).trim(),
        content: String(parsed.content).trim(),
        topic: String(parsed.topic).trim(),
        meta_title: String(parsed.meta_title).trim(),
        meta_description: String(parsed.meta_description).trim()
      };

      return {
        success: true,
        article,
        provider: "gemini",
        model,
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      lastError = `خطای ارتباط با Gemini (${model}): ${detail}`;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  return {
    success: false,
    provider: "gemini",
    model,
    message: lastError || "تولید مقاله با Google Gemini ناموفق بود."
  };
}

export async function testGeminiConnection(apiKey: string, model = DEFAULT_MODELS.gemini): Promise<TestConnectionResult> {
  if (!apiKey) {
    return {
      success: false,
      provider: "gemini",
      model,
      message: "کلید GEMINI_API_KEY تنظیم نشده است."
    };
  }

  const startTime = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: "پاسخ کوتاه تک کلمه‌ای بده: سلام",
      config: {
        maxOutputTokens: 20
      }
    });

    if (response.text && response.text.length > 0) {
      return {
        success: true,
        provider: "gemini",
        model,
        latencyMs: Date.now() - startTime,
        message: `اتصال با موفقیت برقرار شد. مدل پاسخ داد (${Date.now() - startTime}ms).`
      };
    }

    return {
      success: false,
      provider: "gemini",
      model,
      message: "ارتباط برقرار شد اما پاسخی دریافت نگردید."
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      provider: "gemini",
      model,
      latencyMs: Date.now() - startTime,
      message: `خطای اتصال به Gemini: ${detail}`
    };
  }
}
