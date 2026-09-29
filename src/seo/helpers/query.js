import { containsSemanticPhrase, normalizeSemanticText, semanticTokens } from "./text.js";

export const GENERIC_QUERY_TOKENS = new Set([
  "آموزش", "کلاس", "دوره", "موسیقی", "در", "به", "از", "برای",
  "و", "یا", "با", "را", "این", "یک", "چه", "چگونه", "چطور",
  "شوشتر", "فاتح", "یادگیری", "مدرس"
]);

export function normalizeQuery(value) {
  return normalizeSemanticText(value);
}

export function queryTokens(value) {
  return new Set(
    semanticTokens(value)
      .filter((token) => token.length >= 2 && !GENERIC_QUERY_TOKENS.has(token))
  );
}

const BRAND_GENERIC_TOKENS = new Set([
  "آموزش", "کلاس", "دوره", "موسیقی", "آموزشگاه", "academy", "music",
  "ir", "www", "در", "شوشتر", "فاتح", "fateh", "آدرس", "تماس", "ثبت", "نام"
]);

export function isBrandNavigationQuery(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;

  if (
    normalized === "fatehmusic.ir" ||
    normalized === "www.fatehmusic.ir" ||
    normalized === "fateh music" ||
    normalized === "fateh music academy" ||
    normalized === "آموزشگاه موسیقی فاتح" ||
    normalized === "آموزشگاه فاتح" ||
    containsSemanticPhrase(normalized, "آموزشگاه موسیقی فاتح")
  ) {
    return true;
  }

  const tokens = semanticTokens(normalized);
  const tokenSet = new Set(tokens);
  const hasLatinBrandCore =
    tokenSet.has("fatehmusic") ||
    (tokenSet.has("fateh") && tokenSet.has("music"));
  if (hasLatinBrandCore) {
    return tokens.every((token) => BRAND_GENERIC_TOKENS.has(token));
  }

  const hasPersianBrandCore =
    tokenSet.has("فاتح") &&
    (tokenSet.has("آموزشگاه") || tokenSet.has("موسیقی"));
  if (hasPersianBrandCore) {
    return tokens.every((token) => BRAND_GENERIC_TOKENS.has(token));
  }

  return false;
}

export function isOwnershipEligibleQuery(query, minWords = 2) {
  const normalized = normalizeQuery(query);
  const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

  return Boolean(
    normalized &&
    !isBrandNavigationQuery(normalized) &&
    wordCount >= Math.max(1, Number(minWords) || 2) &&
    queryTokens(normalized).size >= 1
  );
}
