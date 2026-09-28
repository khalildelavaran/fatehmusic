import { describe, expect, it } from "vitest";
import { findComparisonCourses } from "./comparison-courses.js";

describe("comparison course resolver", () => {
  it("finds both courses in a comparison title", () => {
    const courses = findComparisonCourses("تفاوت تار و سه‌تار در چیست؟ کدام را انتخاب کنیم");
    expect(courses.map((course) => course.slug)).toEqual(
      expect.arrayContaining(["tar-course", "setar-course"])
    );
    expect(courses).toHaveLength(2);
  });

  it("does not classify a normal course article as comparison", () => {
    expect(findComparisonCourses("آموزش تار برای مبتدی‌ها")).toHaveLength(0);
  });
});
