import { matchCoursesInTitle } from "./content-strategy/course-matching.js";

export function findComparisonCourses(title, courses = [], limit = 2) {
  const normalizedTitle = String(title || "").normalize("NFKC").toLocaleLowerCase("fa");
  if (!/تفاوت|مقایسه| یا /u.test(normalizedTitle)) return [];
  return matchCoursesInTitle(title, courses, {
    comparison: true,
    limit: Math.max(0, Number(limit) || 2)
  });
}
