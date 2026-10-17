function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;|&#xA0;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&#(\d+);/gu, (_match, digits) => {
      const point = Number(digits);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    })
    .replace(/&#x([\da-f]+);/giu, (_match, digits) => {
      const point = Number.parseInt(digits, 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    });
}

export function articleContentToText(value) {
  return decodeHtmlEntities(String(value ?? "")
    .replace(/<!--[\\s\\S]*?-->/gu, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, " ")
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol|tr|table|section|article|blockquote)\s*>/giu, "\n")
    .replace(/<[^>]*>/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, "")
    .replace(/^\s*[-*+]\s+/gmu, "")
    .replace(/^\s*\d+[.)]\s+/gmu, "")
    .replace(/[>*_~\u0060]/gu, " ")
    .replace(/[\t\r\n]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim());
}

function truncateSummary(value, maxLength) {
  const text = String(value ?? "").replace(/\s+/gu, " ").trim();
  const limit = Math.max(20, Number(maxLength) || 220);
  if (!text || text.length <= limit) return text;

  const cut = text.slice(0, limit - 1);
  const sentenceEnd = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("؟"), cut.lastIndexOf("!"), cut.lastIndexOf("؛"));
  if (sentenceEnd >= Math.floor(limit * 0.55)) return cut.slice(0, sentenceEnd + 1).trim();

  const lastSpace = cut.lastIndexOf(" ");
  const readableCut = lastSpace >= Math.floor(limit * 0.6) ? cut.slice(0, lastSpace) : cut;
  return readableCut.trimEnd() + "…";
}

export function summarizeArticleContent(content, maxLength = 220) {
  return truncateSummary(articleContentToText(content), maxLength);
}
