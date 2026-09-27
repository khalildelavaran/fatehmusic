import { describe, expect, it } from "vitest";
import { courses } from "../../src/data/courses.js";
import { courseContent } from "../../src/data/course-content.js";
import { buildFallbackCourseContent } from "../../src/data/course-content-fallback.js";

describe("course SEO content coverage", () => {
  it("provides structured SEO content for every active course", () => {
    const activeCourses = courses.filter((course) => course.active !== false);
    expect(activeCourses.length).toBeGreaterThan(0);

    for (const course of activeCourses) {
      const content = courseContent[course.slug] ?? buildFallbackCourseContent(course);
      expect(content, `missing SEO content for ${course.slug}`).toBeTruthy();
      expect(content?.overview?.length, `overview missing for ${course.slug}`).toBeGreaterThanOrEqual(2);
      expect(content?.learningPath?.length, `learning path missing for ${course.slug}`).toBeGreaterThanOrEqual(3);
      expect(content?.curriculum?.length, `curriculum missing for ${course.slug}`).toBeGreaterThanOrEqual(4);
      expect(content?.commonMistakes?.length, `mistakes missing for ${course.slug}`).toBeGreaterThanOrEqual(3);
      expect(content?.skillsGained?.length, `skills missing for ${course.slug}`).toBeGreaterThanOrEqual(4);
      expect(content?.faqAdditions?.length, `FAQ missing for ${course.slug}`).toBeGreaterThanOrEqual(2);
    }
  });
});
