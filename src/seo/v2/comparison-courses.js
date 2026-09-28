import { courses } from "../../data/courses.js";
import { containsSemanticPhrase, normalizeSemanticText } from "../helpers/text.js";

function normalize(value) {
  return normalizeSemanticText(value);
}

export function findComparisonCourses(title, limit = 2) {
  const normalizedTitle = normalize(title);
  if (!/تفاوت|مقایسه| یا /u.test(normalizedTitle)) return [];

  return courses
    .filter((course) => course.active && course.slug && course.title)
    .filter((course) => {
      const name = normalize(course.title)
        .replace(/^آموزش /u, "")
        .replace(/^دوره /u, "");
      return name && containsSemanticPhrase(title || "", name);
    })
    .slice(0, Math.max(0, limit));
}
