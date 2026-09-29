import { isComparisonCourseTitle, matchCoursesInTitle } from "./content-strategy/course-matching.js";

export function findComparisonCourses(title, courses = [], limit = 2) {
  if (!isComparisonCourseTitle(title)) return [];
  return matchCoursesInTitle(title, courses, {
    comparison: true,
    limit: Math.max(0, Number(limit) || 2)
  });
}
