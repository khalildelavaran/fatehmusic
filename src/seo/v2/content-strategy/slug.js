import { normalizeSemanticText } from "../../helpers/text.js";
import { isShushtarTopic } from "./resolvers.js";

function normalize(value) {
  return normalizeSemanticText(value);
}

export function slugToken(value) {
  const normalized = normalize(value);
  const map = new Map([
    ["کودک", "child"],
    ["نوجوان", "teen"],
    ["بزرگسال", "adult"],
    ["مبتدی", "beginner"],
    ["متوسط", "intermediate"],
    ["پیشرفته", "advanced"]
  ]);
  return map.get(normalized) || normalized
    .replace(/[^a-z0-9\u0600-\u06ff]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const PERSIAN_SLUG_MAP = Object.freeze({
  "ا":"a","آ":"a","ب":"b","پ":"p","ت":"t","ث":"s","ج":"j","چ":"ch","ح":"h","خ":"kh",
  "د":"d","ذ":"z","ر":"r","ز":"z","ژ":"zh","س":"s","ش":"sh","ص":"s","ض":"z","ط":"t",
  "ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"gh","ک":"k","گ":"g","ل":"l","م":"m","ن":"n",
  "و":"v","ه":"h","ی":"y","ء":"a","ئ":"y","ؤ":"v"
});

function transliterateSlug(value) {
  return normalize(value)
    .split("")
    .map((char) => PERSIAN_SLUG_MAP[char] ?? char)
    .join("");
}

export function slugifyArticleTitle(title) {
  return transliterateSlug(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function canonicalSlug(
  topic,
  isLocal = false,
  course = null,
  angle = "guide",
  audience = "",
  level = ""
) {
  const courseKey = course?.slug || null;
  const base = courseKey || (topic.slug === "shushtar" ? "music-education" : topic.slug);
  const scope = isLocal || isShushtarTopic(topic) ? "shushtar" : "";
  const parts = [base, scope, slugToken(angle), slugToken(audience), slugToken(level)].filter(Boolean);
  return [...new Set(parts)].join("-");
}
