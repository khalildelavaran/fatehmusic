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
  "ir", "www", "در", "شوشتر", "shushtar", "خوزستان", "khuzestan",
  "فاتح", "fateh", "موزیک", "آدرس", "تماس", "ثبت", "نام"
].map(normalizeQuery));

const BRAND_EXACT_QUERIES = new Set([
  "fatehmusic.ir",
  "www.fatehmusic.ir",
  "fateh music",
  "fateh music academy",
  "آموزشگاه موسیقی فاتح",
  "آموزشگاه فاتح",
  "فاتح موزیک"
].map(normalizeQuery));

export function isBrandNavigationQuery(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;

  if (BRAND_EXACT_QUERIES.has(normalized)) return true;

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

/**
 * Conservative semantic modifier ontology shared by query clustering,
 * competitive-gap matching and other SEO intelligence layers.
 */
export const SEMANTIC_QUERY_MODIFIER_FAMILIES = Object.freeze({
  pricing: Object.freeze(["قیمت", "هزینه", "شهریه", "تعرفه"]),
  enrollment: Object.freeze(["ثبت نام", "رزرو", "نام نویسی"]),
  guidance: Object.freeze(["راهنما", "راهنمایی", "چگونه", "چطور", "شروع یادگیری"]),
  curriculum: Object.freeze(["سرفصل", "مباحث آموزشی", "برنامه آموزشی"]),
  comparison: Object.freeze(["تفاوت", "فرق", "مقایسه"]),
  instructor: Object.freeze(["مدرس", "استاد"]),
  audience: Object.freeze(["کودک", "نوجوان", "بزرگسال"]),
  style: Object.freeze(["پاپ", "کلاسیک", "فلامنکو", "سنتی", "بختیاری", "شوشتری"]),
  tips: Object.freeze(["نکات", "اشتباه", "اشتباهات", "خطا"])
});

const NORMALIZED_SEMANTIC_QUERY_MODIFIER_FAMILIES = Object.freeze(
  Object.fromEntries(
    Object.entries(SEMANTIC_QUERY_MODIFIER_FAMILIES).map(([family, aliases]) => [
      family,
      Object.freeze(aliases.map(normalizeQuery).filter(Boolean))
    ])
  )
);

function containsJoinedTokenPhrase(source, alias) {
  const sourceTokens = semanticTokens(source);
  const aliasTokens = semanticTokens(alias);
  if (aliasTokens.length < 2 || !sourceTokens.length) return false;

  const joinedAlias = aliasTokens.join("");
  if (!joinedAlias) return false;

  // Accept both «ثبت‌نام» (one normalized token) and «ثبت نام»
  // (two normalized tokens), but never use a raw substring match.
  for (let index = 0; index < sourceTokens.length; index += 1) {
    if (sourceTokens[index] === joinedAlias) return true;
    if (index + aliasTokens.length <= sourceTokens.length &&
        sourceTokens.slice(index, index + aliasTokens.length).join("") === joinedAlias) {
      return true;
    }
  }

  return false;
}

function containsOntologyPhrase(source, alias) {
  return containsSemanticPhrase(source, alias) || containsJoinedTokenPhrase(source, alias);
}

export function querySemanticDimensions(value) {
  const normalized = normalizeQuery(value);
  if (!normalized) {
    return Object.freeze({
      normalized: "",
      modifierFamilies: Object.freeze([]),
      consumedTokens: Object.freeze([]),
      substantiveTokens: Object.freeze([]),
      local: false
    });
  }

  const modifierFamilies = [];
  const consumedTokens = new Set();

  for (const [family, aliases] of Object.entries(NORMALIZED_SEMANTIC_QUERY_MODIFIER_FAMILIES)) {
    const matchedAliases = aliases.filter((alias) => containsOntologyPhrase(normalized, alias));
    if (!matchedAliases.length) continue;

    modifierFamilies.push(family);
    for (const alias of matchedAliases) {
      for (const token of semanticTokens(alias)) consumedTokens.add(token);
      const joinedAlias = semanticTokens(alias).join("");
      if (joinedAlias) consumedTokens.add(joinedAlias);
    }
  }

  const substantiveTokens = [...queryTokens(normalized)]
    .filter((token) => !consumedTokens.has(token))
    .sort();

  return Object.freeze({
    normalized,
    modifierFamilies: Object.freeze(modifierFamilies.sort()),
    consumedTokens: Object.freeze([...consumedTokens].sort()),
    substantiveTokens: Object.freeze(substantiveTokens),
    local: containsSemanticPhrase(normalized, "شوشتر")
  });
}

export function querySemanticFeatureSet(value) {
  const dimensions = querySemanticDimensions(value);
  const anchored = dimensions.substantiveTokens.length > 0 || dimensions.local;

  // Modifier families are useful only when attached to a semantic subject.
  // A modifier-only query such as «قیمت کلاس» must not become a global
  // cluster for every pricing-related topic.
  return new Set([
    ...dimensions.substantiveTokens,
    ...(anchored ? dimensions.modifierFamilies.map((family) => "mod:" + family) : []),
    ...(dimensions.local ? ["scope:local"] : [])
  ]);
}
