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

/**
 * Semantic terms used by the slug generator.
 *
 * Prefer English concepts over letter-by-letter Persian transliteration:
 * unrecognized Persian words are intentionally omitted instead of generating
 * misleading URLs such as "gytar" for "گیتار". Extend this dictionary when
 * new high-value music topics appear.
 */
const SEMANTIC_PHRASES = Object.freeze({
  "چرا دانستن تئوری موسیقی برای نواختن گیتار مهم است": "why-music-theory-matters-for-guitar",
  "اموزش گیتار برای مبتدیان": "guitar-lessons-for-beginners",
  "اموزش گیتار برای مبتدیها": "guitar-lessons-for-beginners",
  "اموزش پیانو": "piano-lessons",
  "اموزش گیتار": "guitar-lessons",
  "اموزش تار": "tar-lessons",
  "اموزش سه تار": "setar-lessons",
  "اموزش سنتور": "santur-lessons",
  "اموزش ویولن": "violin-lessons",
  "اموزش کمانچه": "kamancheh-lessons",
  "اموزش دف": "daf-lessons",
  "اموزش تنبک": "tonbak-lessons",
  "اموزش موسیقی کودک": "music-lessons-for-children",
  "اموزش صداسازی": "vocal-training",
  "اواز سنتی": "traditional-singing",
  "موسیقی سنتی": "traditional-music",
  "تئوری موسیقی": "music-theory",
  "موسیقی کودک": "music-for-children",
  "سازهای زهی": "string-instruments",
  "نت خوانی": "music-reading"
});

const SUBJECT_PHRASES = Object.freeze({
  "اواز سنتی": "traditional-singing",
  "صداسازی": "vocal-training",
  "تئوری موسیقی": "music-theory",
  "موسیقی سنتی": "traditional-music",
  "موسیقی کودک": "music-for-children",
  "موسیقی کودکان": "music-for-children",
  "سازهای زهی": "string-instruments",
  "سه تار": "setar",
  "سهتار": "setar",
  "نت خوانی": "music-reading",
  "نتخوانی": "music-reading",
  "گیتار": "guitar",
  "پیانو": "piano",
  "تار": "tar",
  "سنتور": "santur",
  "ویولن": "violin",
  "کمانچه": "kamancheh",
  "دف": "daf",
  "تنبک": "tonbak",
  "عود": "oud",
  "فلوت": "flute",
  "درام": "drums",
  "درامز": "drums",
  "ساکسیفون": "saxophone",
  "کلارینت": "clarinet",
  "اکاردئون": "accordion",
  "موسیقی": "music",
  "اواز": "singing",
  "خوانندگی": "singing",
  "ساز": "instrument",
  "موسیقیدان": "musician",
  "موسیقی دان": "musician"
});

const WORD_TRANSLATIONS = Object.freeze({
  "چرا": "why",
  "چگونه": "how-to",
  "اموزش": "lessons",
  "اموزشگاه": "academy",
  "کلاس": "lessons",
  "دوره": "course",
  "یادگیری": "learning",
  "یاد": "learn",
  "یادبگیریم": "learn",
  "نواختن": "playing",
  "تئوری": "theory",
  "موسیقی": "music",
  "برای": "for",
  "از": "from",
  "در": "in",
  "با": "with",
  "به": "to",
  "و": "and",
  "یا": "or",
  "مهم": "important",
  "اهمیت": "importance",
  "است": "",
  "هست": "",
  "بود": "",
  "را": "",
  "های": "",
  "هزینه": "cost",
  "قیمت": "price",
  "بهترین": "best",
  "رایج": "common",
  "اشتباه": "mistake",
  "اشتباهات": "mistakes",
  "شروع": "starting",
  "راهنما": "guide",
  "راهنمای": "guide",
  "کودک": "children",
  "کودکان": "children",
  "مبتدی": "beginner",
  "مبتدیان": "beginners",
  "مبتدیها": "beginners",
  "نوجوان": "teen",
  "نوجوانان": "teens",
  "بزرگسال": "adult",
  "بزرگسالان": "adults",
  "انتخاب": "choosing",
  "ساز": "instrument",
  "سازها": "instruments",
  "مناسب": "suitable",
  "چه": "what",
  "چیست": "what-is",
  "کدام": "which",
  "کسانی": "people",
  "روش": "way",
  "روشها": "ways",
  "روشهای": "ways",
  "تمرین": "practice",
  "موثر": "effective",
  "تاثیر": "impact",
  "مزایا": "benefits",
  "فواید": "benefits",
  "نکات": "tips",
  "تکنیک": "techniques",
  "تکنیکها": "techniques",
  "مهارت": "skills",
  "مهارتها": "skills",
  "پیشرفت": "progress",
  "یادگیری": "learning",
  "صفر": "scratch",
  "صدا": "voice",
  "فرکانس": "frequency",
  "ملودی": "melody",
  "ریتم": "rhythm",
  "تفاوت": "difference",
  "مقایسه": "comparison",
  "تفاوتها": "differences",
  "سریع": "quickly",
  "اسان": "easy",
  "ساده": "simple",
  "سن": "age",
  "برنامه": "plan",
  "روزانه": "daily",
  "درست": "correct",
  "صحیح": "correct",
  "شناخت": "understanding",
  "دانستن": "understanding",
  "خواندن": "reading",
  "خوانندگی": "singing",
  "سنتی": "traditional",
  "علاقه": "interest",
  "هنرجو": "student",
  "هنرجویان": "students",
  "والدین": "parents",
  "فرزند": "child",
  "شوشتر": "shushtar"
});

const PERSIAN_PREFIXES = /^(?:اموزشگاه|اموزش|کلاس|دوره|یادگیری|شروع یادگیری|نواختن|یاد گرفتن)\s+/u;
const PERSIAN_SUFFIXES = /\s+(?:در شوشتر|برای مبتدی(?:ها|ان)?|برای کودکان|برای کودک|مناسب مبتدیان)$/u;

function finishSlug(value) {
  const tokens = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const result = [];
  let length = 0;
  for (const token of tokens) {
    const nextLength = length + token.length + (result.length ? 1 : 0);
    if (nextLength > 80) break;
    result.push(token);
    length = nextLength;
  }
  return result.join("-");
}

function translateSubject(value) {
  let subject = normalize(value)
    .replace(/[؟?!،,:;؛.()\[\]{}"'«»]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  subject = subject.replace(PERSIAN_SUFFIXES, "").trim();
  subject = subject.replace(PERSIAN_PREFIXES, "").trim();
  subject = subject.replace(/^(?:را|از|در|به)\s+/u, "").trim();
  subject = subject.replace(/\s+(?:را|است|هست|میکنیم|می کنیم)$/u, "").trim();

  if (SUBJECT_PHRASES[subject]) return SUBJECT_PHRASES[subject];

  const words = subject.split(/\s+/).filter(Boolean);
  const translated = [];
  for (let index = 0; index < words.length;) {
    let matchedPhrase = "";
    let matchedLength = 0;
    for (const phrase of Object.keys(SUBJECT_PHRASES).sort((a, b) => b.split(" ").length - a.split(" ").length)) {
      const phraseWords = phrase.split(" ");
      if (phraseWords.length <= matchedLength || index + phraseWords.length > words.length) continue;
      if (phraseWords.every((word, offset) => words[index + offset] === word)) {
        matchedPhrase = SUBJECT_PHRASES[phrase];
        matchedLength = phraseWords.length;
      }
    }
    if (matchedLength) {
      translated.push(matchedPhrase);
      index += matchedLength;
      continue;
    }

    const word = words[index++];
    if (/^[a-z0-9-]+$/i.test(word)) {
      translated.push(word);
      continue;
    }
    const meaning = WORD_TRANSLATIONS[word];
    if (meaning) translated.push(meaning);
  }
  return finishSlug(translated.join(" "));
}

function translateByTitlePattern(title) {
  const rules = [
    [/^چرا دانستن تئوری موسیقی برای نواختن (.+?) مهم است$/u, (m) => `why-music-theory-matters-for-${translateSubject(m[1])}`],
    [/^چگونه (.+?) را از صفر یاد بگیریم$/u, (m) => `how-to-learn-${translateSubject(m[1])}-from-scratch`],
    [/^راهنمای شروع یادگیری (.+?) برای مبتدی(?:ها|ان)$/u, (m) => `${translateSubject(m[1])}-lessons-for-beginners`],
    [/^اشتباهات رایج در شروع یادگیری (.+)$/u, (m) => `common-mistakes-when-learning-${translateSubject(m[1])}`],
    [/^هزینه کلاس (.+?) در شوشتر$/u, (m) => `cost-of-${translateSubject(m[1])}-lessons-in-shushtar`],
    [/^قیمت کلاس (.+?) در شوشتر$/u, (m) => `price-of-${translateSubject(m[1])}-lessons-in-shushtar`],
    [/^کلاس (.+?) در شوشتر$/u, (m) => `${translateSubject(m[1])}-lessons-in-shushtar`],
    [/^اموزش (.+?) در شوشتر$/u, (m) => `${translateSubject(m[1])}-lessons-in-shushtar`],
    [/^اموزش (.+?) برای مبتدی(?:ها|ان)$/u, (m) => `${translateSubject(m[1])}-lessons-for-beginners`],
    [/^اموزش (.+?) برای کودکان$/u, (m) => `${translateSubject(m[1])}-lessons-for-children`],
    [/^هزینه کلاس (.+)$/u, (m) => `cost-of-${translateSubject(m[1])}-lessons`],
    [/^قیمت دوره (.+)$/u, (m) => `price-of-${translateSubject(m[1])}-course`],
    [/^بهترین دوره (.+)$/u, (m) => `best-${translateSubject(m[1])}-course`],
    [/^بهترین روش (.+)$/u, (m) => `best-way-to-${translateSubject(m[1])}`],
    [/^چگونه (.+?) را یاد بگیریم$/u, (m) => `how-to-learn-${translateSubject(m[1])}`],
    [/^راهنمای (.+)$/u, (m) => `${translateSubject(m[1])}-guide`],
    [/^اموزش (.+)$/u, (m) => `${translateSubject(m[1])}-lessons`],
    [/^بهترین (.+)$/u, (m) => `best-${translateSubject(m[1])}`],
    [/^تفاوت (.+?) و (.+?)(?: در چیست)?(?: کدام را انتخاب کنیم)?$/u, (m) => `difference-between-${translateSubject(m[1])}-and-${translateSubject(m[2])}`]
  ];

  for (const [pattern, build] of rules) {
    const match = title.match(pattern);
    if (match) {
      const slug = finishSlug(build(match));
      if (slug.replace(/-/g, "").length >= 3) return slug;
    }
  }
  return "";
}

function translateKnownWords(title) {
  const words = title
    .replace(/[؟?!،,:;؛.()\[\]{}"'«»]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const translated = [];
  for (let index = 0; index < words.length;) {
    let matchedPhrase = "";
    let matchedLength = 0;
    for (const phrase of Object.keys(SUBJECT_PHRASES).sort((a, b) => b.split(" ").length - a.split(" ").length)) {
      const phraseWords = phrase.split(" ");
      if (phraseWords.length <= matchedLength || index + phraseWords.length > words.length) continue;
      if (phraseWords.every((word, offset) => words[index + offset] === word)) {
        matchedPhrase = SUBJECT_PHRASES[phrase];
        matchedLength = phraseWords.length;
      }
    }
    if (matchedLength) {
      translated.push(matchedPhrase);
      index += matchedLength;
      continue;
    }

    const word = words[index++];
    if (/^[a-z0-9-]+$/i.test(word)) {
      translated.push(word);
      continue;
    }
    const meaning = WORD_TRANSLATIONS[word];
    if (meaning) translated.push(meaning);
  }
  return translated.join(" ");
}

export function slugifyArticleTitle(title) {
  const normalized = normalize(title)
    .replace(/[؟?!،,:;؛.()\[\]{}"'«»]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  const direct = SEMANTIC_PHRASES[normalized];
  if (direct) return finishSlug(direct);

  const patterned = translateByTitlePattern(normalized);
  if (patterned) return patterned;

  // English titles already carry semantic terms; keep them intact.
  if (!/[\u0600-\u06ff]/u.test(normalized)) return finishSlug(normalized);

  // Never transliterate unknown Persian spellings into untrustworthy URLs.
  // Only recognized semantic terms are kept; empty output signals that the
  // caller should use its existing canonical-topic fallback or stop safely.
  return finishSlug(translateKnownWords(normalized));
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
