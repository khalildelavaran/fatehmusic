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

  it("does not double-assign a compound instrument to its component topic", () => {
    const topics = resolveTopics({
      title: "آموزش سه تار در شوشتر"
    }).map((topic) => topic.slug);

    expect(topics).toContain("setar");
    expect(topics).not.toContain("tar");
  });

  it("does not assign ney to the compound ney-anban phrase", () => {
    const topics = resolveTopics({
      title: "کلاس نی انبان در شوشتر"
    }).map((topic) => topic.slug);

    expect(topics).toContain("neyanban");
    expect(topics).not.toContain("ney");
  });
});
