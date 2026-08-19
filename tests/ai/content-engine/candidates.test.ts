import { describe, it, expect } from "vitest";
import { courses } from "../../../src/data/courses.js";
import { COMPARISON_PAIRS } from "../../../src/data/content-engine-seeds";
import { getInstrumentAnchors, derivePlainName, generateCandidates } from "../../../src/ai/content-engine/candidates";

interface CourseLike { slug: string; active: boolean }

describe("getInstrumentAnchors", () => {
  it("matches the number of active courses in courses.js (the frozen source of truth)", () => {
    const expectedCount = (courses as CourseLike[]).filter((c) => c.active).length;
    expect(getInstrumentAnchors()).toHaveLength(expectedCount);
  });
});

describe("derivePlainName", () => {
  it("strips the آموزش prefix", () => {
    expect(derivePlainName("آموزش گیتار")).toBe("گیتار");
  });

  it("strips the دوره prefix", () => {
    expect(derivePlainName("دوره سلفژ")).toBe("سلفژ");
  });

  it("falls back to the original string when there is no known prefix", () => {
    expect(derivePlainName("چیزی بدون پیشوند")).toBe("چیزی بدون پیشوند");
  });
});

describe("generateCandidates", () => {
  const candidates = generateCandidates();

  it("produces a non-empty pool", () => {
    expect(candidates.length).toBeGreaterThan(50);
  });

  it("gives every candidate a non-empty title and normalized key", () => {
    for (const c of candidates) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.normalizedKey.length).toBeGreaterThan(0);
    }
  });

  it("never pairs buying_guide with the vocal (آواز) category", () => {
    const offending = candidates.filter((c) => c.category === "آواز" && c.modifierType === "buying_guide");
    expect(offending).toHaveLength(0);
  });

  it("never pairs theory_link with the theory (دروس پایه موسیقی) category", () => {
    const offending = candidates.filter((c) => c.category === "دروس پایه موسیقی" && c.modifierType === "theory_link");
    expect(offending).toHaveLength(0);
  });

  it("only assigns parent_guide to کودک/نوجوان audiences, never بزرگسال or general", () => {
    const offending = candidates.filter((c) => c.modifierType === "parent_guide" && !["کودک", "نوجوان"].includes(c.audience));
    expect(offending).toHaveLength(0);
  });

  it("includes at least one evergreen/general candidate not tied to a course", () => {
    expect(candidates.some((c) => c.modifierType === "evergreen_general" && c.relatedCourseSlug === null)).toBe(true);
  });
});

describe("COMPARISON_PAIRS data integrity", () => {
  const activeSlugsSet = new Set((courses as CourseLike[]).filter((c) => c.active).map((c) => c.slug));

  it("references only real, currently-active course slugs", () => {
    for (const [a, b] of COMPARISON_PAIRS) {
      expect(activeSlugsSet.has(a), `${a} should be an active course slug`).toBe(true);
      expect(activeSlugsSet.has(b), `${b} should be an active course slug`).toBe(true);
    }
  });
});
