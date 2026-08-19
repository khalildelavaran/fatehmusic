// Transparent topic scoring. Every factor is documented and derived from
// real, available signals -- no fabricated search-volume/trend numbers
// (see providers/keyword-provider.ts). Pure function: coverage counts and
// the keyword signal are passed in rather than fetched here, so this
// stays unit-testable without D1 or network access.

import { classifyIntent } from "./intent";
import { LOCAL_ANCHOR_TERMS } from "../../data/content-engine-seeds";
import type { KeywordSignal } from "./providers/keyword-provider";
import type { ScoreBreakdown, ScoredCandidate, TopicCandidate } from "./types";

export interface ScoringContext {
  /** courseSlug ("__general__" for evergreen) -> existing content_topics/blog_posts
   * count already covering it. Keyed by COURSE, not by the broader instrument
   * family: courses.js deliberately keeps e.g. the four vocal styles as
   * separate Landing Pages (AGENTS.md Decision 012, "never merge"), so
   * coverage must be tracked per page, not per instrument. */
  coverageByCourse: Map<string, number>;
  /** courseSlugs used within the "recent" window (see pipeline.ts), for the freshness penalty. */
  recentlyUsedCourses: Set<string>;
  keywordSignal: KeywordSignal;
}

function scoreBusinessFit(candidate: TopicCandidate): number {
  if (candidate.modifierType === "comparison") return 28; // strengthens two Landing Pages at once
  if (candidate.relatedCourseSlug) return 30; // directly strengthens one Landing Page (AGENTS.md Decision 017)
  return 12; // evergreen/general -- still supports brand authority, just not one specific page
}

function scoreContentGap(candidate: TopicCandidate, ctx: ScoringContext): number {
  const key = candidate.relatedCourseSlug ?? "__general__";
  const existing = ctx.coverageByCourse.get(key) ?? 0;
  return Math.max(0, 25 - existing * 5);
}

function scoreLocalRelevance(candidate: TopicCandidate): number {
  if (candidate.modifierType === "local_shushtar") return 15;
  if (LOCAL_ANCHOR_TERMS.some((term) => candidate.title.includes(term))) return 12;
  return 5; // articles still support local SEO indirectly via internal links to course pages
}

function scoreIntentQuality(intent: TopicCandidate["intent"]): number {
  switch (intent) {
    case "informational": return 15; // Helpful Content is the stated priority (AGENTS.md)
    case "commercial": return 10; // comparison/buying-guide posts are genuinely useful
    case "navigational": return 8;
    case "transactional": return 5; // legitimate but this is "not a shop" (CONTENT_ENGINE_SPECIFICATION.md)
    default: return 8;
  }
}

function scoreKeywordSignal(signal: KeywordSignal): number {
  if (!signal.available || signal.estimatedVolume === undefined) return 7; // neutral: genuinely unknown, not zero
  const difficulty = signal.difficulty ?? 50;
  const volumeScore = Math.min(1, Math.log10(1 + signal.estimatedVolume) / 3); // saturates around ~1000/mo
  const difficultyPenalty = difficulty / 100;
  return Math.round(15 * volumeScore * (1 - difficultyPenalty * 0.6));
}

function scoreFreshnessPenalty(candidate: TopicCandidate, ctx: ScoringContext): number {
  if (candidate.relatedCourseSlug && ctx.recentlyUsedCourses.has(candidate.relatedCourseSlug)) return -8;
  return 0;
}

function buildReasoning(candidate: TopicCandidate, breakdown: ScoreBreakdown, keywordSignal: KeywordSignal): string {
  const parts: string[] = [];
  if (candidate.relatedCourseSlug) parts.push(`به دوره «${candidate.relatedCourseTitle}» مرتبط است`);
  else if (candidate.modifierType === "evergreen_general") parts.push("موضوع عمومی/همیشه‌سبز است");
  if (breakdown.contentGap >= 20) parts.push("این حوزه هنوز مقاله‌ی کمی دارد");
  else if (breakdown.contentGap <= 5) parts.push("این حوزه اخیراً پوشش داده شده");
  parts.push(`قصد جستجو: ${candidate.intent}`);
  if (!keywordSignal.available) parts.push("داده‌ی حجم جستجو در دسترس نیست (امتیاز خنثی لحاظ شد)");
  if (breakdown.freshnessPenalty < 0) parts.push("همین ساز اخیراً استفاده شده (امتیاز کاهش یافت)");
  return parts.join("؛ ") + ".";
}

export function scoreCandidate(candidate: TopicCandidate, ctx: ScoringContext): ScoredCandidate {
  const intent = classifyIntent(candidate.title);
  const breakdown: ScoreBreakdown = {
    businessFit: scoreBusinessFit(candidate),
    contentGap: scoreContentGap(candidate, ctx),
    localRelevance: scoreLocalRelevance(candidate),
    intentQuality: scoreIntentQuality(intent),
    keywordSignal: scoreKeywordSignal(ctx.keywordSignal),
    freshnessPenalty: scoreFreshnessPenalty(candidate, ctx)
  };
  const scoreTotal = Math.max(
    0,
    breakdown.businessFit + breakdown.contentGap + breakdown.localRelevance +
      breakdown.intentQuality + breakdown.keywordSignal + breakdown.freshnessPenalty
  );
  return {
    ...candidate,
    intent,
    scoreTotal,
    scoreBreakdown: breakdown,
    reasoning: buildReasoning(candidate, breakdown, ctx.keywordSignal)
  };
}

export function scoreCandidates(candidates: TopicCandidate[], ctx: ScoringContext): ScoredCandidate[] {
  return candidates.map((c) => scoreCandidate(c, ctx)).sort((a, b) => b.scoreTotal - a.scoreTotal);
}

/** A candidate is auto-approved (no human click needed) only above this
 * bar; everything else lands as "candidate" for a human to review in
 * /admin/topics. Kept deliberately high -- this is a review queue, not
 * a fully autonomous publisher (matching "No article should exist
 * without purpose" / human final review culture in this repo). */
export const AUTO_APPROVE_THRESHOLD = 55;
