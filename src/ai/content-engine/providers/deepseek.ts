// DeepSeek API client (OpenAI-compatible /chat/completions).
//
// IMPORTANT -- verified against api-docs.deepseek.com (Aug 2026):
//   - Model IDs are now "deepseek-v4-flash" / "deepseek-v4-pro". The old
//     "deepseek-chat" / "deepseek-reasoner" aliases are retired as of
//     2026-07-24, so this deliberately does NOT use them.
//   - Thinking mode defaults to ENABLED (effort "high") on v4 models.
//     This is the exact same failure class already hit once in this repo
//     with Workers AI's glm-4.7-flash (reasoning burns the token budget,
//     `content` comes back empty/null) -- so thinking is explicitly
//     disabled below via `thinking: { type: "disabled" }`. Do not remove
//     this without re-reading doc/ADR/ADR-011.
//   - `response_format: { type: "json_object" }` makes the API guarantee
//     parseable JSON in `choices[0].message.content`; extractJson() below
//     is kept only as a defensive fallback, matching this repo's existing
//     style in the old ai-post-generator.ts.

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-flash";

export interface DeepSeekCallResult {
  success: true;
  content: string;
}
export interface DeepSeekCallError {
  success: false;
  message: string;
}

function extractJson(raw: string): string | null {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // fall through
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = cleaned.slice(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

/** Calls DeepSeek and returns raw JSON text (already validated to parse).
 * Callers still JSON.parse() it themselves since this module doesn't know
 * the expected shape. */
export async function callDeepSeekJson(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8192
): Promise<DeepSeekCallResult | DeepSeekCallError> {
  if (!apiKey) {
    return { success: false, message: "DEEPSEEK_API_KEY تنظیم نشده است. آن را به‌صورت Cloudflare Secret اضافه کنید." };
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" } // see module header -- avoids the empty-content bug
      })
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { success: false, message: `اتصال به DeepSeek برقرار نشد: ${detail}` };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    return {
      success: false,
      message: `DeepSeek خطای HTTP ${response.status} برگرداند: ${bodyText.slice(0, 300)}`
    };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    return { success: false, message: "پاسخ DeepSeek قابل parse به JSON نبود." };
  }

  const choice = (data as any)?.choices?.[0];
  const raw = choice?.message?.content;
  if (!raw) {
    const finishReason = choice?.finish_reason ?? "نامشخص";
    const reasoningPreview = String(choice?.message?.reasoning_content ?? "").slice(0, 200);
    return {
      success: false,
      message: `پاسخ DeepSeek خالی بود (content=null). دلیل توقف: ${finishReason}${
        finishReason === "length" ? " -- یعنی توکن‌ها قبل از رسیدن به جواب نهایی تمام شد." : ""
      }. ابتدای reasoning: ${reasoningPreview || "(خالی)"}`
    };
  }

  const jsonText = extractJson(String(raw));
  if (!jsonText) {
    return { success: false, message: `خروجی DeepSeek JSON معتبر نبود. ابتدای خروجی: ${String(raw).slice(0, 400)}` };
  }

  return { success: true, content: jsonText };
}
