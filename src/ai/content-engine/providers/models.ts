// Supported models catalog for Google Gemini, Anthropic Claude, and OpenAI.
// Gemini is the system-wide default provider.

import type { AiProvider, AiModelInfo } from "../types";

export const SUPPORTED_MODELS: Record<AiProvider, AiModelInfo[]> = {
  gemini: [
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash (پیش‌فرض پیشنهادی)",
      description: "سریع‌ترین و کارآمدترین مدل هوش مصنوعی برای تولید مقالات سئو و متون فارسی با کیفیت بالا",
      recommended: true
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro Preview",
      description: "مدل با قدرت استدلال عمیق و تحلیل محتوایی پیشرفته برای موضوعات پیچیده آموزشی",
      recommended: false
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      description: "مدل سبک و فوق‌سریع مناسب برای تولید سریع و کم‌هزینه پیش‌نویس‌ها",
      recommended: false
    }
  ],
  claude: [
    {
      id: "claude-sonnet-5",
      name: "Claude Sonnet 5 (پیش‌فرض کلود)",
      description: "مدل نسل جدید سونت با لحن طبیعی و غنای نگارشی فوق‌العاده در زبان فارسی",
      recommended: true
    },
    {
      id: "claude-3-5-sonnet-latest",
      name: "Claude 3.5 Sonnet",
      description: "نسخه معتبر و پایدار سونت ۳.۵ با ساختاربندی بسیار دقیق مقالات آموزشی",
      recommended: false
    },
    {
      id: "claude-3-5-haiku-latest",
      name: "Claude 3.5 Haiku",
      description: "مدل چابک آنتروپیک مناسب برای سرعت بالا",
      recommended: false
    }
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o (پیش‌فرض OpenAI)",
      description: "مدل هوشمند پرچم‌دار OpenAI با پشتیبانی قوی از درک زمینه و نگارش فارسی",
      recommended: true
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      description: "مدل اقتصادی، سریع و هوشمند برای تولید حجم مداوم پیش‌نویس‌ها",
      recommended: false
    },
    {
      id: "o3-mini",
      name: "o3-mini",
      description: "مدل تخصصی استدلال و تفکر ساختارمند",
      recommended: false
    }
  ]
};

export const DEFAULT_PROVIDER: AiProvider = "gemini";
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: "gemini-3.8-flash",
  claude: "claude-sonnet-5",
  openai: "gpt-4o"
};

export function isValidProvider(provider: unknown): provider is AiProvider {
  return typeof provider === "string" && (provider === "gemini" || provider === "claude" || provider === "openai");
}

export function getDefaultModelForProvider(provider: AiProvider): string {
  return DEFAULT_MODELS[provider] || "gemini-3.8-flash";
}

export function isValidModelForProvider(provider: AiProvider, model: string): boolean {
  const models = SUPPORTED_MODELS[provider] || [];
  return models.some((m) => m.id === model);
}
