// Transparent topic scoring. Search Console impressions are an observed-demand signal.
import { classifyIntent } from "./intent";
import { LOCAL_ANCHOR_TERMS } from "../../data/content-engine-seeds";
import type { KeywordSignal } from "./providers/keyword-provider";
import type { ScoreBreakdown, ScoredCandidate, TopicCandidate } from "./types";

export interface ScoringContext {
  coverageByCourse: Map<string, number>;
  recentlyUsedCourses: Set<string>;
  keywordSignal?: KeywordSignal;
  keywordSignals?: Map<string, KeywordSignal>;
}

function scoreBusinessFit(candidate: TopicCandidate): number {
  if (candidate.modifierType === "comparison") return 28;
  if (candidate.relatedCourseSlug) return 30;
  return 12;
}

function scoreContentGap(candidate: TopicCandidate, ctx: ScoringContext): number {
  const key = candidate.relatedCourseSlug ?? "__general__";
  const existing = ctx.coverageByCourse.get(key) ?? 0;
  return Math.max(0, 25 - existing * 5);
}

function scoreLocalRelevance(candidate: TopicCandidate): number {
  if (candidate.modifierType === "local_shushtar") return 15;
  if (LOCAL_ANCHOR_TERMS.some((term) => candidate.title.includes(term))) return 12;
  return 5;
}

function scoreIntentQuality(intent: TopicCandidate["intent"]): number {
  switch (intent) {
    case "informational": return 15;
    case "commercial": return 10;
    case "navigational": return 8;
    case "transactional": return 5;
    default: return 8;
  }
}

function scoreKeywordSignal(signal: KeywordSignal): number {
  if (!signal.available) return 7;

  if (signal.estimatedVolume !== undefined) {
    const difficulty = signal.difficulty ?? 50;
    const volumeScore = Math.min(1, Math.log10(1 + signal.estimatedVolume) / 3);
    return Math.round(15 * volumeScore * (1 - (difficulty / 100) * 0.6));
  }

  const impressions = Math.max(0, Number(signal.searchImpressions) || 0);
  const position = Number(signal.searchPosition);
  const ctr = Math.max(0, Number(signal.searchCtr) || 0);
  if (impressions <= 0) return 7;

  let score = impressions >= 2000 ? 7 : impressions >= 1000 ? 6 : impressions >= 300 ? 5 : impressions >= 100 ? 4 : 2;
  if (Number.isFinite(position)) {
    if (position <= 5) score += 4;
    else if (position <= 10) score += 3;
    else if (position <= 20) score += 2;
    else if (position <= 50) score += 1;
  }
  if (ctr < 0.02) score += 3;
  else if (ctr < 0.04) score += 2;
  else if (ctr < 0.06) score += 1;
  return Math.min(15, score);
}

function scoreFreshnessPenalty(candidate: TopicCandidate, ctx: ScoringContext): number {
  if (candidate.relatedCourseSlug && ctx.recentlyUsedCourses.has(candidate.relatedCourseSlug)) return -8;
  return 0;
}

function buildReasoning(candidate: TopicCandidate, breakdown: ScoreBreakdown, keywordSignal: KeywordSignal): string {
  const parts: string[] = [];
  if (candidate.relatedCourseSlug) parts.push("به دوره «" + candidate.relatedCourseTitle + "» مرتبط است");
  else if (candidate.modifierType === "evergreen_general") parts.push("موضوع عمومی/همیشه‌سبز است");
  if (breakdown.contentGap >= 20) parts.push("این حوزه هنوز مقاله‌ی کمی دارد");
  else if (breakdown.contentGap <= 5) parts.push("این حوزه اخیراً پوشش داده شده");
  parts.push("قصد جستجو: " + candidate.intent);
  if (keywordSignal.available && keywordSignal.searchImpressions) {
    parts.push("بر اساس " + Math.round(keywordSignal.searchImpressions).toLocaleString("fa-IR") + " impression مشاهده‌شده در Search Console");
  } else if (!keywordSignal.available) {
    parts.push("سیگنال تقاضای مشاهده‌شده در Search Console در دسترس نیست (امتیاز خنثی لحاظ شد)");
  }
  if (breakdown.freshnessPenalty < 0) parts.push("همین ساز اخیراً استفاده شده (امتیاز کاهش یافت)");
  return parts.join("؛ ") + ".";
}

export function scoreCandidate(candidate: TopicCandidate, ctx: ScoringContext): ScoredCandidate {
  const keywordSignal = ctx.keywordSignals?.get(candidate.normalizedKey) || ctx.keywordSignal || { available: false, source: "none" };
  const intent = classifyIntent(candidate.title);
  const breakdown: ScoreBreakdown = {
    businessFit: scoreBusinessFit(candidate),
    contentGap: scoreContentGap(candidate, ctx),
    localRelevance: scoreLocalRelevance(candidate),
    intentQuality: scoreIntentQuality(intent),
    keywordSignal: scoreKeywordSignal(keywordSignal),
    freshnessPenalty: scoreFreshnessPenalty(candidate, ctx)
  };
  const scoreTotal = Math.max(
    0,
    breakdown.businessFit +
    breakdown.contentGap +
    breakdown.localRelevance +
    breakdown.intentQuality +
    breakdown.keywordSignal +
    breakdown.freshnessPenalty
  );
  return {
    ...candidate,
    intent,
    scoreTotal,
    scoreBreakdown: breakdown,
    reasoning: buildReasoning(candidate, breakdown, keywordSignal)
  };
}

export function scoreCandidates(candidates: TopicCandidate[], ctx: ScoringContext): ScoredCandidate[] {
  return candidates.map((candidate) => scoreCandidate(candidate, ctx))
    .sort((a, b) => b.scoreTotal - a.scoreTotal);
}

export const AUTO_APPROVE_THRESHOLD = 55;
