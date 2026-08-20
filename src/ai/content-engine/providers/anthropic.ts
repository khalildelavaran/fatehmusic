// Claude (Anthropic Messages API) article-writing provider.
// Replaces providers/deepseek.ts -- DeepSeek's account/balance behavior
// was unreliable in practice (see doc/ADR/ADR-011, "Amendment" section),
// so the article-writing step now calls Claude directly.
//
// Uses a FORCED tool call (tool_choice: {type:"tool", name:...}) instead
// of asking for raw JSON in the text response. Two real advantages over
// the old DeepSeek approach:
//   1. The API parses and returns `input` as an actual object -- no more
//      regex/markdown-fence stripping to recover JSON from free text.
//   2. Forced tool_choice makes the model skip straight to the structured
//      call (no preamble to strip), and, importantly, is INCOMPATIBLE
//      with extended thinking -- so this call structurally cannot hit the
//      "thinking ate the token budget, content came back empty" bug this
//      project already hit twice (Workers AI, then DeepSeek). Do not add
//      a `thinking` parameter to this request.

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

const ARTICLE_TOOL = {
  name: "submit_article",
  description: "ثبت نسخه‌ی نهایی مقاله برای وبلاگ آموزشگاه موسیقی فاتح.",
  input_schema: {
    type: "object",
    properties: {
      slug: { type: "string", description: "اسلاگ انگلیسی URL، فقط حروف کوچک و خط تیره" },
      excerpt: { type: "string", description: "خلاصه‌ی دو تا سه جمله‌ای فارسی" },
      content: { type: "string", description: "متن کامل مقاله به فارسی، پاراگراف‌ها با دو خط جدید (\\n\\n) از هم جدا شده" },
      topic: { type: "string", description: "دسته‌بندی کوتاه فارسی، مثلا: آموزش گیتار" },
      meta_title: { type: "string", description: "عنوان سئو، زیر ۶۰ کاراکتر" },
      meta_description: { type: "string", description: "توضیح متای سئو، زیر ۱۵۵ کاراکتر" }
    },
    required: ["slug", "excerpt", "content", "topic", "meta_title", "meta_description"]
  }
};

export interface ClaudeArticle {
  slug: string;
  excerpt: string;
  content: string;
  topic: string;
  meta_title: string;
  meta_description: string;
}
export interface ClaudeCallResult {
  success: true;
  article: ClaudeArticle;
}
export interface ClaudeCallError {
  success: false;
  message: string;
}

export async function callClaudeArticle(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8192
): Promise<ClaudeCallResult | ClaudeCallError> {
  if (!apiKey) {
    return { success: false, message: "ANTHROPIC_API_KEY تنظیم نشده است. آن را به‌صورت Cloudflare Secret اضافه کنید." };
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [ARTICLE_TOOL],
        tool_choice: { type: "tool", name: "submit_article" }
      })
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { success: false, message: `اتصال به Anthropic برقرار نشد: ${detail}` };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    return { success: false, message: `Anthropic خطای HTTP ${response.status} برگرداند: ${bodyText.slice(0, 300)}` };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { success: false, message: "پاسخ Anthropic قابل parse به JSON نبود." };
  }

  const toolBlock = (data?.content ?? []).find((block: any) => block?.type === "tool_use");
  if (!toolBlock) {
    return {
      success: false,
      message: `پاسخ Anthropic فاقد tool_use بود (stop_reason: ${data?.stop_reason ?? "نامشخص"}).`
    };
  }

  const input = toolBlock.input as Partial<ClaudeArticle> | undefined;
  const missing = ["slug", "excerpt", "content", "topic", "meta_title", "meta_description"].filter(
    (key) => !input || typeof (input as any)[key] !== "string" || (input as any)[key].length === 0
  );
  if (!input || missing.length > 0) {
    return { success: false, message: `خروجی Claude فیلدهای الزامی رو نداشت: ${missing.join(", ")}` };
  }

  return { success: true, article: input as ClaudeArticle };
}
