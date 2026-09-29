import { describe, expect, it } from "vitest";
import { courseMatchesArticleTitle } from "../../src/ai/content-engine/article-generator";

describe("article generator course matching", () => {
  const catalog = [
    { slug: "tar-course", title: "آموزش تار", active: true, instructors: [] },
    { slug: "setar-course", title: "آموزش سه تار", active: true, instructors: [] },
    { slug: "ney-course", title: "آموزش نی", active: true, instructors: [] },
    { slug: "ney-anban-course", title: "آموزش نی انبان", active: true, instructors: [] },
    { slug: "guitar-course", title: "آموزش گیتار", active: true, instructors: [] },
    { slug: "piano-course", title: "آموزش پیانو", active: true, instructors: [] }
  ];

  it("prefers a specific compound course over a parent course", () => {
    expect(
      courseMatchesArticleTitle("راهنمای شروع سه تار", catalog)
        .map((course: any) => course.slug)
    ).toEqual(["setar-course"]);
  });

  it("does not confuse ney with ney-anban", () => {
    expect(
      courseMatchesArticleTitle("چگونه نی انبان را یاد بگیریم", catalog)
        .map((course: any) => course.slug)
    ).toEqual(["ney-anban-course"]);
  });

  it("keeps two independent courses for a comparison title", () => {
    expect(
      courseMatchesArticleTitle("تفاوت تار و سه تار چیست؟", catalog)
        .map((course: any) => course.slug)
    ).toEqual(["setar-course", "tar-course"]);
  });

  it("returns only a specific matching course for a normal single-topic title", () => {
    expect(
      courseMatchesArticleTitle("آموزش و تمرین گیتار برای مبتدی‌ها", catalog)
        .map((course: any) => course.slug)
    ).toEqual(["guitar-course"]);
  });
});
