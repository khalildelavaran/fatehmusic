import { describe, expect, it } from "vitest";
import {
  findCourseForTopic,
  findCourseFromTitle,
  resolveTopicFromTitle,
  isShushtarTopic
} from "./resolvers.js";

describe("content strategy semantic resolvers", () => {
  const courses = [
    { slug: "guitar-course", title: "آموزش گیتار", instrument: "guitar" },
    { slug: "tar-course", title: "آموزش تار", instrument: "tar" },
    { slug: "traditional-vocal-course", title: "آموزش آواز سنتی", instrument: "vocal" }
  ];

  it("resolves the most specific topic without substring collisions", () => {
    expect(resolveTopicFromTitle("آموزش گیتار در شوشتر").slug).toBe("guitar");
    expect(resolveTopicFromTitle("آموزش گیتار در شوشتر").slug).not.toBe("tar");
  });

  it("resolves a course only from a complete semantic phrase", () => {
    expect(findCourseFromTitle("راهنمای آموزش گیتار", courses)?.slug).toBe("guitar-course");
    expect(findCourseFromTitle("پایدارسازی تمرین هنرجو", courses)).toBeNull();
  });

  it("keeps local scope explicit", () => {
    expect(isShushtarTopic({ slug: "shushtar" })).toBe(true);
    expect(isShushtarTopic({ slug: "guitar", name: "گیتار" })).toBe(false);
  });

  it("returns null when vocal course mapping is ambiguous", () => {
    const vocalCourses = [
      { slug: "traditional-vocal-course", title: "آموزش آواز سنتی", instrument: "vocal" },
      { slug: "pop-vocal-course", title: "آموزش آواز پاپ", instrument: "vocal" }
    ];
    expect(findCourseForTopic(
      { slug: "vocal", name: "آواز", aliases: ["آواز"] },
      vocalCourses,
      "کلاس آواز"
    )).toBeNull();
  });
});
