// Persian text normalization for the Content Intelligence Engine.
//
// Two separate concerns, kept as two separate functions on purpose:
//   1. Character-level unification (Arabic vs Persian letterforms, digits,
//      diacritics, ZWNJ/whitespace noise) -- always safe to apply.
//   2. Stopword-stripped tokenization -- only for *comparing* titles
//      (near-duplicate detection), never for anything shown to a human,
//      since it deliberately throws away grammar.
//
// No external dependency: this is a small, fully deterministic, pure
// module so it can be unit tested without any Cloudflare bindings.

// Arabic presentation-form and archaic letters that should collapse to
// their standard Persian equivalents before anything else runs.
const CHAR_MAP: Record<string, string> = {
  "ي": "ی", // Arabic yeh -> Persian yeh
  "ك": "ک", // Arabic kaf -> Persian kaf
  "ى": "ی", // Arabic alef maksura -> Persian yeh
  "ة": "ه", // teh marbuta -> heh
  "ؤ": "و",
  "إ": "ا",
  "أ": "ا",
  "آ": "آ",
  "ٱ": "ا",
  "‌": " ", // ZWNJ -> handled separately below, mapped here only inside toDedupKey
};

// Arabic-Indic and Extended Arabic-Indic digits -> ASCII digits.
const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
};

// Arabic diacritics (harakat/tashkeel) + tatweel (kashida).
const DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** Unifies letterforms/digits, strips diacritics, collapses whitespace.
 * Safe to use on display text (does not remove words or punctuation). */
export function normalizePersianText(input: string): string {
  if (!input) return "";
  let out = input.normalize("NFKC");
  out = out.replace(DIACRITICS_RE, "");
  out = out.replace(/[يكىةؤإأآٱ]/g, (ch) => CHAR_MAP[ch] ?? ch);
  out = out.replace(/[۰-۹٠-٩]/g, (ch) => DIGIT_MAP[ch] ?? ch);
  // Zero-width non-joiner: keep single occurrences (نیم‌فاصله is meaningful,
  // e.g. "می‌خواهد"), but collapse runs of it plus surrounding spaces.
  out = out.replace(/\s*\u200C\s*/g, "\u200C");
  out = out.replace(/[ \t]+/g, " ").trim();
  return out;
}

/** Aggressive normalization for exact-match dedup keys: also strips
 * punctuation and ZWNJ and lowercases any Latin characters. Two titles
 * that only differ by "؟" vs no "؟", or by نیم‌فاصله placement, or by
 * Latin-vs-Persian digit style, must resolve to the same key. */
export function toDedupKey(input: string): string {
  const base = normalizePersianText(input);
  return base
    .replace(/\u200C/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Small, curated stopword list for *comparison* tokenization only.
// Deliberately conservative -- under-stripping just means slightly lower
// recall on near-dup detection, which is safe; over-stripping could hide
// a meaningful difference between two real titles.
const STOPWORDS = new Set([
  "و", "در", "به", "از", "که", "این", "را", "با", "برای", "هم", "یا", "تا",
  "بر", "یک", "آن", "های", "ها", "چه", "چرا", "چگونه", "آیا", "است", "می",
  "شود", "شد", "کنیم", "کنید", "بود", "اگر", "همه", "هر", "نیز", "روی",
  "بین", "بدون", "درباره", "درمورد", "مورد"
]);

/** Splits into lowercase, stopword-free tokens for Jaccard comparison. */
export function significantTokens(input: string): string[] {
  const key = toDedupKey(input);
  if (!key) return [];
  return key.split(" ").filter((tok) => tok.length > 1 && !STOPWORDS.has(tok));
}

/** Jaccard similarity (0..1) between the significant-token sets of two titles. */
export function titleSimilarity(a: string, b: string): number {
  const setA = new Set(significantTokens(a));
  const setB = new Set(significantTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const tok of setA) if (setB.has(tok)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
