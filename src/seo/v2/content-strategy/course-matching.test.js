import { describe, expect, it } from "vitest";
import { matchCoursesInTitle } from "./course-matching.js";

describe("canonical semantic course matcher", () => {
  const courses = [
    { slug: "tar-course", title: "آموزش تار", active: true },
    { slug: "setar-course", title: "آموزش سه‌تار", active: true },
    { slug: "ney-course", title: "آموزش نی", active: true },
    { slug: "ney-anban-course", title: "آموزش نی‌انبان", active: true }
  ];

  it("suppresses a parent course when a compound course fully contains it", () => {
    expect(
      matchCoursesInTitle("راهنمای شروع سه‌تار", courses).map((course) => course.slug)
    ).toEqual(["setar-course"]);
  });

  it("does not confuse a compound ney with the standalone ney course", () => {
    expect(
      matchCoursesInTitle("آموزش نی‌انبان برای مبتدیان", courses).map((course) => course.slug)
    ).toEqual(["ney-anban-course"]);
  });

  it("preserves independently mentioned courses for comparison mode", () => {
    expect(
      matchCoursesInTitle("تفاوت تار و سه‌تار", courses, { comparison: true }).map((course) => course.slug)
    ).toEqual(["tar-course", "setar-course"]);
  });
});
