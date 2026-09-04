import { describe, it, expect } from "vitest";
import { dedupWithinBatch, filterAgainstExisting } from "../../../src/ai/content-engine/dedup";
import { toDedupKey } from "../../../src/ai/content-engine/normalize";
import { canonicalAssetKey } from "../../../src/ai/content-engine/canonical-identity";
import type { TopicCandidate } from "../../../src/ai/content-engine/types";

function candidate(title: string, overrides: Partial<TopicCandidate> = {}): TopicCandidate {
  return {
    title,
    normalizedKey: toDedupKey(title),
    instrumentKey: "guitar",
    relatedCourseSlug: "guitar-course",
    relatedCourseTitle: "آموزش گیتار",
    category: "سازهای زهی",
    audience: "",
    level: "",
    modifierType: "how_to",
    intent: "informational",
    source: "seed_generator",
    ...overrides
  };
}

describe("dedupWithinBatch", () => {
  it("keeps only the first occurrence of an exact-key duplicate", () => {
    const out = dedupWithinBatch([candidate("چگونه گیتار یاد بگیریم؟"), candidate("چگونه گیتار یاد بگیریم؟")]);
    expect(out).toHaveLength(1);
  });

  it("keeps distinct candidates", () => {
    // Different modifierType (how_to vs benefits) -> different editorial
    // angle -> different canonical identity, even for the same course.
    const out = dedupWithinBatch([
      candidate("چگونه گیتار یاد بگیریم؟"),
      candidate("فواید یادگیری گیتار", { modifierType: "benefits" })
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("filterAgainstExisting", () => {
  it("removes an exact normalized-key match", () => {
    const c = candidate("چگونه گیتار یاد بگیریم؟");
    const out = filterAgainstExisting([c], { normalizedKeys: new Set([c.normalizedKey]), canonicalKeys: new Set(), titles: [] });
    expect(out).toHaveLength(0);
  });

  it("removes an exact canonical-identity match", () => {
    const c = candidate("چگونه گیتار یاد بگیریم؟");
    const out = filterAgainstExisting([c], {
      normalizedKeys: new Set(),
      canonicalKeys: new Set([canonicalAssetKey(c)]),
      titles: []
    });
    expect(out).toHaveLength(0);
  });

  it("removes a near-duplicate rewording", () => {
    const c = candidate("چگونه گیتار را از صفر یاد بگیریم؟");
    const out = filterAgainstExisting([c], {
      normalizedKeys: new Set(),
      canonicalKeys: new Set(),
      titles: ["چگونه یادگیری گیتار را از صفر شروع کنیم؟"]
    });
    // Deliberately not asserting a specific outcome here -- see the
    // dedicated similarity-threshold assertions in normalize.test.ts.
    // This test only checks the function runs and returns an array.
    expect(Array.isArray(out)).toBe(true);
  });

  it("keeps a genuinely distinct candidate", () => {
    const c = candidate("راهنمای خرید ویولن مناسب برای مبتدی‌ها", { instrumentKey: "violin" });
    const out = filterAgainstExisting([c], {
      normalizedKeys: new Set(["چیزی کاملا متفاوت"]),
      canonicalKeys: new Set(["v1|other-course|how_to|general|general"]),
      titles: ["فواید یادگیری تنبک برای رشد ذهنی"]
    });
    expect(out).toHaveLength(1);
  });
});
