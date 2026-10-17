import { matchCoursesInTitle } from "./course-matching.js";
import { resolveTopicFromTitle } from "./resolvers.js";
import { slugifyArticleTitle } from "./slug.js";

const BRAND_SUFFIX = " | آموزشگاه موسیقی فاتح";
const MAX_META_TITLE_LENGTH = 60;

function clean(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function truncateAtWord(value, maxLength) {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, Math.max(1, maxLength - 1));
  const boundary = cut.lastIndexOf(" ");
  return cut.slice(0, boundary > Math.floor(maxLength * 0.55) ? boundary : cut.length).trim() + "…";
}

function buildMetaTitle(value) {
  const title = clean(value);
  if (!title) return "";
  if (title.includes("آموزشگاه موسیقی فاتح")) return truncateAtWord(title, MAX_META_TITLE_LENGTH);
  if (title.length + BRAND_SUFFIX.length <= MAX_META_TITLE_LENGTH) return title + BRAND_SUFFIX;
  return truncateAtWord(title, MAX_META_TITLE_LENGTH);
}

function isComparisonTopic(value) {
  return /(?:تفاوت|فرق|مقایسه|چه\s+تفاوتی|کدام\s+(?:یک|ساز)|یا\s+کدام)/u.test(value);
}

/**
 * Deterministic SEO metadata suggestions for a blog post.
 * The canonical course catalog is injected by the caller, never duplicated here.
 * @param {{ title?: string, topic?: string, courses?: Array<{ active?: boolean, slug?: string, title?: string }> }} [options]
 */
export function buildArticleSeoFields({ title = "", topic = "", courses = [] } = {}) {
  const articleTitle = clean(title);
  const explicitTopic = clean(topic);
  const catalog = Array.isArray(courses)
    ? courses.filter((course) => course?.active && course?.slug && course?.title)
    : [];
  const matchingText = [explicitTopic, articleTitle].filter(Boolean).join(" ");
  const comparison = isComparisonTopic(matchingText);
  const matches = comparison
    ? matchCoursesInTitle(matchingText, catalog, { comparison: true, limit: 2 })
    : matchCoursesInTitle(matchingText, catalog);

  // A comparison of two courses should not imply that one is the only related course.
  const relatedCourse = comparison && matches.length > 1 ? null : (matches[0] || null);
  const resolvedTopic = resolveTopicFromTitle(articleTitle || explicitTopic);
  const resolvedTopicName = resolvedTopic && !["music-education", "shushtar"].includes(resolvedTopic.slug)
    ? resolvedTopic.name
    : "";
  const suggestedTopic = explicitTopic || resolvedTopicName || relatedCourse?.title || articleTitle;
  const slug = slugifyArticleTitle(articleTitle || suggestedTopic);

  return {
    topic: suggestedTopic,
    slug,
    related_course_slug: relatedCourse?.slug || "",
    related_course_title: relatedCourse?.title || "",
    meta_title: buildMetaTitle(articleTitle || suggestedTopic)
  };
}
