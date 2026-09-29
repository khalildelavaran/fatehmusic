import { containsSemanticPhrase, normalizeSemanticText, semanticTokens } from "../../helpers/text.js";

function normalizeCourseName(title) {
  return normalizeSemanticText(title)
    .replace(/^آموزش\s+/u, "")
    .replace(/^دوره\s+/u, "")
    .trim();
}

export function isComparisonCourseTitle(title) {
  const normalized = normalizeSemanticText(title);
  return /(?:تفاوت|فرق|مقایسه|\sو\s|\sیا\s)/u.test(normalized);
}

export function matchCoursesInTitle(title, courses = [], {
  comparison = false,
  limit = 0
} = {}) {
  const normalizedTitle = normalizeSemanticText(title);
  const catalog = Array.isArray(courses) ? courses : [];
  const matches = catalog
    .filter((course) => course?.active && course?.slug && course?.title)
    .map((course, index) => ({
      course,
      index,
      name: normalizeCourseName(course.title),
      tokens: semanticTokens(normalizeCourseName(course.title))
    }))
    .filter((item) =>
      item.name &&
      containsSemanticPhrase(normalizedTitle, item.name)
    );

  if (comparison) {
    const max = limit > 0 ? limit : matches.length;
    return matches.slice(0, max).map((item) => item.course);
  }

  return matches
    .filter((candidate) => !matches.some((other) =>
      other !== candidate &&
      other.tokens.length > candidate.tokens.length &&
      containsSemanticPhrase(other.name, candidate.name)
    ))
    .sort((a, b) =>
      b.tokens.length - a.tokens.length ||
      b.name.length - a.name.length ||
      a.index - b.index
    )
    .map((item) => item.course);
}

export function courseNameTokens(course) {
  return semanticTokens(normalizeCourseName(course?.title || ""));
}
