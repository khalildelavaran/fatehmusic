import { normalizeSemanticText } from "./text.js";

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
    normalizeQuery(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !GENERIC_QUERY_TOKENS.has(token))
  );
}

export function isBrandNavigationQuery(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;

  return normalized === "fatehmusic.ir" ||
    normalized === "www.fatehmusic.ir" ||
    normalized === "fateh music" ||
    normalized === "fateh music academy" ||
    normalized === "آموزشگاه موسیقی فاتح";
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
