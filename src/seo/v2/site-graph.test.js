import { describe, expect, it } from "vitest";
import { buildSiteLinkCandidates } from "./site-graph.js";

describe("site graph runtime data injection", () => {
  it("does not silently fall back to a hidden static catalog", () => {
    const candidates = buildSiteLinkCandidates({
      url: "https://fatehmusic.ir",
      name: "آموزشگاه موسیقی فاتح",
      keywords: ["آموزش موسیقی", "شوشتر"]
    });

    expect(candidates.some((item) => item.type === "Course")).toBe(false);
    expect(candidates.some((item) => item.type === "Instructor")).toBe(false);
  });

  it("uses the courses and instructors supplied by the orchestrator", () => {
    const candidates = buildSiteLinkCandidates(
      {
        url: "https://fatehmusic.ir",
        name: "آموزشگاه موسیقی فاتح",
        keywords: ["آموزش موسیقی", "شوشتر"]
      },
      {
        courses: [
          {
            slug: "runtime-guitar",
            title: "آموزش گیتار ویژه",
            instrument: "guitar",
            category: "western",
            seo: { keywords: ["گیتار"] }
          }
        ],
        instructors: [
          {
            slug: "runtime-teacher",
            name: "مدرس آزمایشی",
            professional: { roles: ["گیتار"] },
            seo: { keywords: ["گیتار"] }
          }
        ]
      }
    );

    expect(candidates.some((item) => item.url.endsWith("/courses/runtime-guitar"))).toBe(true);
    expect(candidates.some((item) => item.url.endsWith("/instructors/runtime-teacher"))).toBe(true);
    expect(candidates.some((item) => item.url.includes("/courses/guitar-course"))).toBe(false);
  });
});
