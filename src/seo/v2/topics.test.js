import { describe, expect, it } from "vitest";
import { resolveTopics } from "./topics.js";

describe("topic semantic resolution", () => {
  it("does not confuse guitar with tar", () => {
    const topics = resolveTopics({
      title: "آموزش گیتار در شوشتر",
      keywords: ["کلاس گیتار"]
    }).map((topic) => topic.slug);

    expect(topics).toEqual(expect.arrayContaining(["guitar", "shushtar"]));
    expect(topics).not.toContain("tar");
  });

  it("recognizes compound Persian instrument phrases", () => {
    const topics = resolveTopics({
      title: "آموزش سه تار در شوشتر"
    }).map((topic) => topic.slug);

    expect(topics).toContain("setar");
    expect(topics).toContain("shushtar");
  });
});
