import { describe, expect, it } from "vitest";
import { webPageEntityId } from "./url.js";

describe("webPageEntityId", () => {
  it("keeps the root slash but removes trailing slashes from non-root paths", () => {
    expect(webPageEntityId("https://fatehmusic.ir/")).toBe("https://fatehmusic.ir/#webpage");
    expect(webPageEntityId("https://fatehmusic.ir/about/")).toBe("https://fatehmusic.ir/about#webpage");
    expect(webPageEntityId("https://fatehmusic.ir/courses/guitar-course/?utm_source=test")).toBe("https://fatehmusic.ir/courses/guitar-course#webpage");
  });
});
