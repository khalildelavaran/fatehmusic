import { COMPARISON_PAIRS } from "../../../data/content-engine-seeds.ts";
import { TOPICS } from "../topics.js";
import { containsSemanticPhrase, normalizeSemanticText, semanticTokens } from "../../helpers/text.js";
import { SCOPE_ONLY_TOPICS } from "./policy.js";
import { matchCoursesInTitle } from "./course-matching.js";

function normalize(value) {
  return normalizeSemanticText(value);
}

export function findTopic(slug) {
  return TOPICS.find((topic) => topic.slug === slug) || null;
}

export function isShushtarTopic(topic) {
  return topic?.slug === "shushtar" || containsSemanticPhrase(topic?.name || "", "شوشتر");
}

export function localTopicName(topic) {
  return isShushtarTopic(topic) ? "آموزش موسیقی" : (topic?.name || "آموزش موسیقی");
}

export function hasLocalSignal(value) {
  return containsSemanticPhrase(value || "", "شوشتر");
}

export function resolveTopicFromTitle(title, fallback = null) {
  const specific = TOPICS
    .filter((topic) => !SCOPE_ONLY_TOPICS.has(topic.slug) && topic.slug !== "music-education")
    .map((topic) => ({
      topic,
      score: (topic.aliases || []).reduce(
        (sum, alias) => containsSemanticPhrase(title || "", alias)
          ? sum + semanticTokens(alias).length * 10
          : sum,
        0
      )
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      b.topic.name.length - a.topic.name.length ||
      a.topic.name.localeCompare(b.topic.name, "fa")
    );

  if (specific[0]) return specific[0].topic;
  if (hasLocalSignal(title)) return findTopic("shushtar");
  return findTopic(fallback) || findTopic("music-education");
}

export function topicForCourse(course) {
  if (!course) return null;
  const instrument = normalize(course.instrument || "");
  const byInstrument = TOPICS.find((topic) => normalize(topic.slug) === instrument);
  if (byInstrument) return byInstrument;

  const haystack = [course.slug, course.title, course.description]
    .filter(Boolean)
    .join(" | ");

  return TOPICS
    .map((topic) => ({
      topic,
      score: [topic.name, ...(topic.aliases || [])]
        .filter(Boolean)
        .reduce(
          (sum, alias) => containsSemanticPhrase(haystack, alias)
            ? sum + semanticTokens(alias).length * 10
            : sum,
          0
        )
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name, "fa"))[0]?.topic || null;
}

export function resolveCandidateTopic(candidate, course) {
  const explicitTopic = findTopic(candidate.topic || candidate.topicSlug || candidate.topicId);
  const courseTopic = topicForCourse(course);
  const titleTopic = resolveTopicFromTitle(candidate.title, explicitTopic?.slug);
  const subjectTopic = [explicitTopic, courseTopic, titleTopic].find(
    (topic) => topic && !SCOPE_ONLY_TOPICS.has(topic.slug) && topic.slug !== "music-education"
  );
  return subjectTopic || titleTopic || explicitTopic || findTopic("music-education");
}

export function normalizeBaseUrl(siteUrl) {
  return String(siteUrl || "https://fatehmusic.ir").replace(/\/$/, "");
}

export function findCourseFromTitle(title, courses = []) {
  return matchCoursesInTitle(title, courses)[0] || null;
}

export function containsTokenSequence(title, phrase) {
  const normalizedPhrase = normalize(phrase).replace(/^آموزش\s+/, "").trim();
  return Boolean(normalizedPhrase) && containsSemanticPhrase(title || "", normalizedPhrase);
}

export function findComparisonCourses(candidate, courses = []) {
  const candidateSlug = candidate?.relatedCourseSlug || null;
  const pair = COMPARISON_PAIRS.find(([a, b]) => candidateSlug === a || candidateSlug === b);
  if (pair) {
    const pairCourses = pair
      .map((slug) => courses.find((course) => course?.slug === slug))
      .filter(Boolean);
    if (pairCourses.length === 2) return pairCourses;
  }
  return matchCoursesInTitle(candidate?.title || "", courses, {
    comparison: true,
    limit: 2
  });
}

export function findCourseForTopic(topic, courses = [], title = "") {
  if (!topic || isShushtarTopic(topic) || topic.slug === "music-education") return null;
  const fromTitle = findCourseFromTitle(title, courses);
  if (fromTitle) return fromTitle;

  const aliases = [topic.name, ...(topic.aliases || [])]
    .map(normalize)
    .filter((value) => semanticTokens(value).length > 0)
    .sort((a, b) => semanticTokens(b).length - semanticTokens(a).length || b.length - a.length);

  const ranked = courses.map((course) => {
    const haystack = [course?.slug, course?.title, course?.instrument, course?.description]
      .filter(Boolean)
      .join(" | ");

    const exact = aliases.find((alias) => containsSemanticPhrase(haystack, alias));
    const score = exact
      ? 1000 + semanticTokens(exact).length * 10
      : aliases.reduce(
          (sum, alias) => sum + (containsSemanticPhrase(haystack, alias) ? semanticTokens(alias).length * 10 : 0),
          0
        );

    return { course, score };
  }).filter((item) => item.score > 0);

  if (ranked.length === 0) return null;
  const bestScore = Math.max(...ranked.map((item) => item.score));
  const best = ranked.filter((item) => item.score === bestScore);
  if (best.length !== 1) return null;

  const bestCourse = best[0]?.course || null;
  if (!bestCourse) return null;

  const sameInstrument = courses.filter(
    (course) => normalize(course?.instrument || "") === normalize(bestCourse.instrument || "")
  );
  if (sameInstrument.length > 1 && normalize(topic.slug) === "vocal") return null;

  return bestCourse;
}
