import { courseEntityId } from "../../geo/entity.js";
import { INTENT_PRIORITY, INTENT_SUFFIX } from "./policy.js";
import { normalizeSemanticText } from "../../helpers/text.js";
import {
  findTopic,
  isShushtarTopic,
  localTopicName,
  normalizeBaseUrl
} from "./resolvers.js";
import { canonicalSlug, slugifyArticleTitle } from "./slug.js";

function normalize(value) {
  return normalizeSemanticText(value);
}

export function buildTitle(topic, intent, course) {
  const name = localTopicName(topic);
  const courseName = course?.title || name;
  if (intent === "local") return `${name} در شوشتر | راهنمای کلاس و انتخاب دوره`;
  if (intent === "transactional") return `${courseName}: هزینه، شرایط و ثبت‌نام در دوره`;
  if (intent === "commercial") return `${courseName}: راهنمای انتخاب دوره مناسب`;
  if (intent === "navigational") return `${courseName}: معرفی آموزشگاه و مسیر دسترسی`;
  return course ? `${courseName}: ${INTENT_SUFFIX[intent]}` : `${name}: ${INTENT_SUFFIX[intent]} یادگیری و تمرین`;
}

export function buildQueryAngles(topic, intent, course) {
  const name = course?.title || localTopicName(topic);
  const queries = {
    informational: [`چگونه ${name} را شروع کنیم`, `سرفصل های ${name}`, `اشتباهات رایج در ${name}`],
    commercial: [`بهترین دوره ${name}`, `${name} مناسب چه کسانی است`, `مقایسه کلاس ${name}`],
    transactional: [`هزینه کلاس ${name}`, `قیمت دوره ${name}`, `ثبت نام ${name}`],
    local: [`${name} در شوشتر`, `کلاس ${name} شوشتر`, `آموزشگاه ${name} در شوشتر`],
    navigational: [`${name} آموزشگاه موسیقی فاتح`, `${name} فاتح`, `آدرس آموزشگاه موسیقی فاتح`]
  };
  return Object.freeze(queries[intent] || queries.informational);
}

export function buildPriority(intent, articleCount, course, isLocal) {
  return Math.min(
    100,
    (INTENT_PRIORITY[intent] ?? 60) +
    Math.min(20, Math.max(0, 3 - articleCount) * 8) +
    (course ? 12 : 0) +
    (isLocal ? 8 : 0)
  );
}

export function buildTargetEntity(topic, course, isLocal, baseUrl) {
  if (course) {
    const courseUrl = `${baseUrl}/courses/${course.slug}`;
    return { type: "Course", id: courseEntityId(courseUrl), name: course.title, url: courseUrl };
  }
  if (isLocal || isShushtarTopic(topic)) {
    const locationUrl = `${baseUrl}/locations/shushtar`;
    return {
      type: "LocalBusiness",
      id: `${locationUrl}#localbusiness`,
      name: "آموزش موسیقی در شوشتر",
      url: locationUrl
    };
  }
  return {
    type: "Thing",
    id: `${baseUrl}/#topic-${topic.slug}`,
    name: topic.name,
    url: `${baseUrl}/courses`
  };
}

export function buildRecommendedLinks(targetEntity, baseUrl) {
  return Object.freeze([
    ...new Set([
      targetEntity.url,
      `${baseUrl}/locations/shushtar`,
      `${baseUrl}/register`,
      `${baseUrl}/blog`
    ])
  ]);
}

export function canonicalScope(topic, isLocal = false) {
  return isLocal || isShushtarTopic(topic) ? "shushtar" : "global";
}

export function suggestedArticleSlug(item) {
  if (Number(item.articleCount) > 0 && Array.isArray(item.existingArticleSlugs) && item.existingArticleSlugs[0]) {
    return item.existingArticleSlugs[0];
  }
  const titleSlug = slugifyArticleTitle(item.title || item.normalizedKey || "");
  if (titleSlug) return titleSlug;
  return canonicalSlug(
    findTopic(item.topic) || { slug: item.topic || "music-education" },
    Boolean(item.scope === "shushtar" || item.isLocal || item.modifierType === "local_shushtar"),
    item.course || null,
    item.modifierType || item.searchIntent || "guide",
    item.audience || "",
    item.level || ""
  );
}

export function canonicalContentAngle(item) {
  if (item.modifierType === "local_shushtar" || item.scope === "shushtar") return "local_shushtar";
  return item.modifierType || "coverage";
}

export function mergeQueryAngles(topic, intents, course) {
  return Object.freeze([
    ...new Set(
      intents.flatMap((intent) => buildQueryAngles(topic, intent, course))
    )
  ].slice(0, 15));
}

export function makeCourseRef(course, baseUrl) {
  return course
    ? Object.freeze({
        slug: course.slug,
        title: course.title,
        url: `${baseUrl}/courses/${course.slug}`
      })
    : null;
}

export { normalizeBaseUrl, normalize };
