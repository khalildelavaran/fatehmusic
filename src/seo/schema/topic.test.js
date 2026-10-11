import { describe, expect, it } from "vitest";
import { buildTopicSchemas } from "./topic.js";

describe("topic schema", () => {
  it("does not attach inLanguage to generic Thing nodes", () => {
    const nodes = buildTopicSchemas(
      [{ slug: "guitar", name: "گیتار" }],
      { site: { url: "https://fatehmusic.ir" } }
    );

    expect(nodes).toEqual([
      {
        "@type": "Thing",
        "@id": "https://fatehmusic.ir/#topic-guitar",
        name: "گیتار"
      }
    ]);
    expect(nodes[0]).not.toHaveProperty("inLanguage");
  });
});
