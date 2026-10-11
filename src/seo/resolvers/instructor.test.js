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

  it("uses Farnaz Moradi's Instagram identity and leaves Narges Fateh without sameAs", () => {
    expect(resolveInstructor("farnaz-kadkhoda-moradi", site).sameAs).toEqual([
      "https://www.instagram.com/farnazmoradi.ir/"
    ]);
    expect(resolveInstructor("narges-fateh", site).sameAs).toEqual([]);
  });
});
