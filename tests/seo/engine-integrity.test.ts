import { describe, expect, it } from "vitest";
import * as seo from "../../src/seo/index.js";
import { buildSEO } from "../../src/seo/index.js";
import { buildCourseSchema } from "../../src/seo/schema/course.js";
import { resolveSite } from "../../src/seo/index.js";
import { resolveCourse } from "../../src/seo/index.js";
import { slugifyArticleTitle } from "../../src/seo/v2/content-strategy/slug.js";

// Regression guards for defects that once broke `astro build` on main:
// an export list naming a symbol that was never imported, and a module
// importing a symbol its target does not export.
describe("SEO engine public surface", () => {
  it("exports only defined values", () => {
    const undefinedExports = Object.entries(seo).filter(([, v]) => v === undefined).map(([k]) => k);
    expect(undefinedExports).toEqual([]);
  });

  it("exposes the competitive gap report builder", () => {
    expect(typeof seo.buildCompetitiveGapReport).toBe("function");
  });

  it("keeps slugifyArticleTitle in the slug module", () => {
    expect(typeof slugifyArticleTitle).toBe("function");
  });
});

describe("Open Graph image dimensions", () => {
  it("declares 1200x630 for the default cover", () => {
    const result = buildSEO({ path: "/", title: "t", description: "d" });
    const og = result.openGraph as Record<string, string | undefined>;
    expect(og["og:image:width"]).toBe("1200");
    expect(og["og:image:height"]).toBe("630");
  });

  it("does not guess dimensions for a custom image", () => {
    const result = buildSEO({ path: "/", title: "t", description: "d", image: "/images/custom.webp" });
    const og = result.openGraph as Record<string, string | undefined>;
    expect(og["og:image:width"]).toBeUndefined();
  });
});

describe("Course schema", () => {
  it("emits an absolute image URL", () => {
    const site = resolveSite();
    const course = resolveCourse("guitar-course", site);
    const node = buildCourseSchema(course as object, { site }) as { image?: string };
    expect(node.image).toMatch(/^https:\/\//);
  });
});
