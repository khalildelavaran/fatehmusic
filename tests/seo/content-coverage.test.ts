import { describe, expect, it } from "vitest";
import { courses } from "../../src/data/courses.js";
import { instructors } from "../../src/data/instructors.js";
import { courseContent } from "../../src/data/course-content.js";
import { buildFallbackCourseContent } from "../../src/data/course-content-fallback.js";
import { instructorContent } from "../../src/data/instructor-content.js";

const courseEditorial = courseContent as Record<string, any>;
const instructorEditorial = instructorContent as Record<string, any>;

describe("SEO editorial content coverage", () => {
  it("covers every active course with hand-written or specific fallback content", () => {
    for (const course of courses.filter((item) => item.active !== false)) {
      const content = courseEditorial[course.slug] ?? buildFallbackCourseContent(course);
      expect(content, `missing SEO content for course ${course.slug}`).toBeTruthy();
      expect(content?.overview?.length).toBeGreaterThanOrEqual(2);
      expect(content?.learningPath?.length).toBeGreaterThanOrEqual(3);
      expect(content?.curriculum?.length).toBeGreaterThanOrEqual(4);
      expect(content?.commonMistakes?.length).toBeGreaterThanOrEqual(3);
      expect(content?.skillsGained?.length).toBeGreaterThanOrEqual(4);
      expect(content?.faqAdditions?.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("covers every active instructor with hand-written SEO content", () => {
    for (const instructor of instructors.filter((item) => item.active !== false)) {
      const content = instructorEditorial[instructor.slug];
      expect(content, `missing SEO content for instructor ${instructor.slug}`).toBeTruthy();
      expect(content?.quickSummary).toBeTruthy();
      expect(content?.teachingPhilosophy?.length).toBeGreaterThanOrEqual(1);
      expect(content?.methodBySubject?.length).toBeGreaterThanOrEqual(1);
      expect(content?.commonStudentMistakes?.length).toBeGreaterThanOrEqual(2);
      expect(content?.faqAdditions?.length).toBeGreaterThanOrEqual(2);
    }
  });
});
