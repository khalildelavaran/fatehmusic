import { describe, expect, it } from "vitest";
import { courses as courseCatalog } from "../../data/courses.js";
import { findComparisonCourses } from "./comparison-courses.js";

describe("comparison course resolver", () => {
  it("finds both courses in a comparison title", () => {
    const courses = findComparisonCourses("تفاوت تار و سه‌تار در چیست؟ کدام را انتخاب کنیم", courseCatalog);
    expect(courses.map((course) => course.slug)).toEqual(
      expect.arrayContaining(["tar-course", "setar-course"])
    );
    expect(courses).toHaveLength(2);
  });

  it("does not classify a normal course article as comparison", () => {
    expect(findComparisonCourses("آموزش تار برای مبتدی‌ها", courseCatalog)).toHaveLength(0);
  });

  it("does not match a longer unrelated token as a course name", () => {
    expect(
      findComparisonCourses("مقایسه پایداری و سهولت تمرین برای هنرجویان", courseCatalog)
    ).toHaveLength(0);
  });

  it("uses the supplied runtime course catalog instead of hidden static state", () => {
    const runtimeCourses = [
      { slug: "runtime-tar", title: "آموزش تار", active: true },
      { slug: "runtime-setar", title: "آموزش سه‌تار", active: true }
    ];

    const result = findComparisonCourses("تفاوت تار و سه‌تار", runtimeCourses);

    expect(result.map((course) => course.slug)).toEqual(["runtime-tar", "runtime-setar"]);
  });

});
