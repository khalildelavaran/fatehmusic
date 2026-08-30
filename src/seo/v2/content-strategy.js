/**
 * Fateh Music Academy — Content Strategy Engine
 * Turns topical content gaps into deterministic production briefs.
 */
import { TOPICS } from "./topics.js";

const INTENT_PRIORITY = Object.freeze({
  transactional: 100,
  local: 92,
  commercial: 84,
  informational: 70,
  navigational: 58
});

const INTENT_SUFFIX = Object.freeze({
  informational: "راهنمای جامع",
  commercial: "راهنمای انتخاب",
  transactional: "هزینه و ثبت‌نام",
  local: "در شوشتر",
  navigational: "معرفی و مسیر دسترسی"
});

function normalize(value) {
  return String(value ?? "")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .trim()
    .toLowerCase();
}

function findTopic(topicSlug) {
  return TOPICS.find((topic) => topic.slug === topicSlug) || null;
}

function normalizeBaseUrl(siteUrl) {
  return String(siteUrl || "https://fatehmusic.ir").replace(/\/$/, "");
}

function findCourseForTopic(topic, courses = []) {
  if (!topic) return null;
  const aliases = [topic.name, ...(topic.aliases || [])].map(normalize).filter(Boolean);
  return courses.find((course) => {
    const corpus = normalize([
      course?.slug,
      course?.title,
      course?.instrument,
      course?.description
    ].filter(Boolean).join(" | "));
    return aliases.some((alias) => corpus.includes(alias));
  }) || null;
}

function buildTitle(topic, intent, course) {
  const name = topic?.name || "آموزش موسیقی";
  if (intent === "local") return `${name} در شوشتر | راهنمای کلاس و انتخاب دوره`;
  if (intent === "transactional") return `${name}: هزینه، شرایط و ثبت‌نام در دوره`;
  if (intent === "commercial") return `${name}: راهنمای انتخاب دوره مناسب`;
  if (intent === "navigational") return `${name}: معرفی آموزشگاه و مسیر دسترسی`;
  if (course?.title) return `${name}: ${INTENT_SUFFIX[intent]} برای شروع یادگیری`;
  return `${name}: ${INTENT_SUFFIX[intent]} یادگیری و تمرین`;
}

function buildQueryAngles(topic, intent, course) {
  const name = topic?.name || "آموزش موسیقی";
  const courseTitle = course?.title || name;
  const queries = {
    informational: [`چگونه ${name} را شروع کنیم`, `سرفصل های ${name}`, `اشتباهات رایج در ${name}`],
    commercial: [`بهترین دوره ${name}`, `${name} مناسب چه کسانی است`, `مقایسه کلاس ${name}`],
    transactional: [`هزینه کلاس ${name}`, `قیمت دوره ${name}`, `ثبت نام ${name}`],
    local: [`${name} در شوشتر`, `کلاس ${name} شوشتر`, `آموزشگاه ${name} در شوشتر`],
    navigational: [`${courseTitle} آموزشگاه موسیقی فاتح`, `${name} فاتح`, `آدرس آموزشگاه موسیقی فاتح`]
  };
  return Object.freeze(queries[intent] || queries.informational);
}

function buildPriority(intent, articleCount, course, isLocal) {
  const base = INTENT_PRIORITY[intent] ?? 60;
  const scarcity = Math.min(20, Math.max(0, 3 - articleCount) * 8);
  const entityBoost = course ? 12 : 0;
  const localBoost = isLocal ? 8 : 0;
  return Math.min(100, base + scarcity + entityBoost + localBoost);
}

function buildBrief(gap, courses = [], siteUrl) {
  const topic = findTopic(gap.topic);
  const intent = gap.missingIntents?.[0];
  if (!topic || !intent) return null;

  const baseUrl = normalizeBaseUrl(siteUrl);
  const course = findCourseForTopic(topic, courses);
  const isLocal = intent === "local" || topic.slug === "shushtar";
  const targetEntity = isLocal
    ? { type: "Place", id: `${baseUrl}/#place-shushtar`, name: "آموزش موسیقی در شوشتر", url: `${baseUrl}/locations/shushtar` }
    : course
      ? { type: "Course", id: `${baseUrl}/#course-${course.slug}`, name: course.title, url: `${baseUrl}/courses/${course.slug}` }
      : { type: "Thing", id: `${baseUrl}/#topic-${topic.slug}`, name: topic.name, url: `${baseUrl}/courses` };

  return Object.freeze({
    topic: topic.slug,
    topicName: topic.name,
    searchIntent: intent,
    title: buildTitle(topic, intent, course),
    suggestedSlug: `${topic.slug}-${intent}`,
    targetEntity,
    course: course ? Object.freeze({ slug: course.slug, title: course.title, url: `${baseUrl}/courses/${course.slug}` }) : null,
    priority: buildPriority(intent, gap.articleCount, course, isLocal),
    articleCount: gap.articleCount,
    existingArticleSlugs: gap.articleSlugs || [],
    rationale: `پوشش intent «${intent}» برای خوشه «${topic.name}» ناقص است؛ با ${gap.articleCount} مقاله فعلی، ایجاد یک محتوای هدفمند می‌تواند این شکاف را پوشش دهد.`,
    queryAngles: buildQueryAngles(topic, intent, course),
    recommendedLinks: Object.freeze([
      targetEntity.url,
      `${baseUrl}/locations/shushtar`,
      `${baseUrl}/register`,
      `${baseUrl}/blog`
    ])
  });
}

export function buildContentStrategyFromGaps(gaps = [], courses = [], siteUrl) {
  return gaps
    .flatMap((gap) => (gap.missingIntents || []).map((intent) => buildBrief({ ...gap, missingIntents: [intent] }, courses, siteUrl)).filter(Boolean))
    .sort((a, b) => b.priority - a.priority || a.topic.localeCompare(b.topic, "fa") || a.searchIntent.localeCompare(b.searchIntent));
}

export function buildContentStrategy(gaps = [], courses = [], { siteUrl } = {}) {
  const briefs = buildContentStrategyFromGaps(gaps, courses, siteUrl);
  return Object.freeze({
    briefCount: briefs.length,
    highPriorityCount: briefs.filter((item) => item.priority >= 85).length,
    briefs: Object.freeze(briefs)
  });
}
