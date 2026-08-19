import { describe, it, expect } from "vitest";
import { scoreCandidate, AUTO_APPROVE_THRESHOLD } from "../../../src/ai/content-engine/scoring";
import { toDedupKey } from "../../../src/ai/content-engine/normalize";
import type { ScoringContext } from "../../../src/ai/content-engine/scoring";
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

const emptyContext: ScoringContext = {
  coverageByCourse: new Map(),
  recentlyUsedCourses: new Set(),
  keywordSignal: { available: false, source: "none" }
};

describe("scoreCandidate", () => {
  it("scores a course-linked candidate higher on businessFit than an evergreen one", () => {
    const linked = scoreCandidate(candidate("چگونه گیتار یاد بگیریم؟"), emptyContext);
    const evergreen = scoreCandidate(
      candidate("چطور فرزندمان را برای موسیقی آماده کنیم", { relatedCourseSlug: null, relatedCourseTitle: null, modifierType: "evergreen_general" }),
      emptyContext
    );
    expect(linked.scoreBreakdown.businessFit).toBeGreaterThan(evergreen.scoreBreakdown.businessFit);
  });

  it("lowers contentGap as existing coverage for that course grows", () => {
    const ctxWithCoverage: ScoringContext = { ...emptyContext, coverageByCourse: new Map([["guitar-course", 4]]) };
    const uncovered = scoreCandidate(candidate("چگونه گیتار یاد بگیریم؟"), emptyContext);
    const covered = scoreCandidate(candidate("چگونه گیتار یاد بگیریم؟"), ctxWithCoverage);
    expect(covered.scoreBreakdown.contentGap).toBeLessThan(uncovered.scoreBreakdown.contentGap);
  });

  it("never lets contentGap go negative even with heavy coverage", () => {
    const ctx: ScoringContext = { ...emptyContext, coverageByCourse: new Map([["guitar-course", 50]]) };
    const scored = scoreCandidate(candidate("چگونه گیتار یاد بگیریم؟"), ctx);
    expect(scored.scoreBreakdown.contentGap).toBeGreaterThanOrEqual(0);
  });

  it("applies a freshness penalty when the course was recently used", () => {
    const ctx: ScoringContext = { ...emptyContext, recentlyUsedCourses: new Set(["guitar-course"]) };
    const scored = scoreCandidate(candidate("چگونه گیتار یاد بگیریم؟"), ctx);
    expect(scored.scoreBreakdown.freshnessPenalty).toBeLessThan(0);
  });

  it("gives a neutral (non-zero) keyword score when no provider data is available", () => {
    const scored = scoreCandidate(candidate("چگونه گیتار یاد بگیریم؟"), emptyContext);
    expect(scored.scoreBreakdown.keywordSignal).toBeGreaterThan(0);
  });

  it("never returns a negative total score", () => {
    const ctx: ScoringContext = {
      coverageByCourse: new Map([["guitar-course", 100]]),
      recentlyUsedCourses: new Set(["guitar-course"]),
      keywordSignal: { available: false, source: "none" }
    };
    const scored = scoreCandidate(candidate("هزینه ثبت‌نام کلاس گیتار", { relatedCourseSlug: "guitar-course" }), ctx);
    expect(scored.scoreTotal).toBeGreaterThanOrEqual(0);
  });

  it("scores a strong, uncovered, course-linked informational topic above the auto-approve threshold", () => {
    const scored = scoreCandidate(candidate("چگونه گیتار را از صفر یاد بگیریم؟"), emptyContext);
    expect(scored.scoreTotal).toBeGreaterThanOrEqual(AUTO_APPROVE_THRESHOLD);
  });

  it("always attaches a non-empty, readable reasoning string", () => {
    const scored = scoreCandidate(candidate("چگونه گیتار یاد بگیریم؟"), emptyContext);
    expect(scored.reasoning.length).toBeGreaterThan(0);
  });
});
