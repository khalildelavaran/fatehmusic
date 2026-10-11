import { describe, expect, it } from "vitest";
import { resolveInstructor } from "./instructor.js";
import { resolveSite } from "./site.js";

describe("resolveInstructor sameAs", () => {
  const site = resolveSite();

  it("keeps valid absolute HTTP(S) links and converts valid Instagram handles", () => {
    const resolved = resolveInstructor({
      id: 9999,
      slug: "test-instructor",
      name: "مدرس آزمایشی",
      position: "مدرس موسیقی",
      social: {
        instagram: "@music.teacher",
        youtube: "https://bad url/",
        telegram: "javascript:alert(1)",
        website: "https://www.example.com/profile"
      }
    }, site);

    expect(resolved.sameAs).toEqual([
      "https://www.instagram.com/music.teacher/",
      "https://www.example.com/profile"
    ]);
  });

  it("does not publish sameAs on the two profiles from the Search Console report when no social URLs exist", () => {
    expect(resolveInstructor("farnaz-kadkhoda-moradi", site).sameAs).toEqual([]);
    expect(resolveInstructor("narges-fateh", site).sameAs).toEqual([]);
  });
});
