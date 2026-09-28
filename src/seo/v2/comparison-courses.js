import { courses } from "../../data/courses.js";

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\s\-_]+/g, " ")
    .trim()
    .toLowerCase();
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
      return name && normalizedTitle.includes(name);
    })
    .slice(0, Math.max(0, limit));
}
