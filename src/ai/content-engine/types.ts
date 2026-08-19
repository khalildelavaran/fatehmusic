// Shared types for the Content Intelligence Engine.
// See doc/ADR/ADR-011 — Content Intelligence Engine.md for the design rationale.

export type Audience = "" | "کودک" | "نوجوان" | "بزرگسال";
export type Level = "" | "مبتدی" | "متوسط" | "پیشرفته";

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational";

/** Which title-template family produced a candidate. Kept as a small,
 * curated set (not the full combinatorial space) so every combination
 * can be validated for sense and produces genuinely natural Persian. */
export type ModifierType =
  | "how_to"
  | "mistakes"
  | "comparison"
  | "buying_guide"
  | "practice_tips"
  | "theory_link"
  | "parent_guide"
  | "local_shushtar"
  | "age_specific"
  | "benefits"
  | "career_path"
  | "evergreen_general";

export type TopicStatus = "candidate" | "approved" | "rejected" | "used";

/** A single instrument/course anchor, derived from src/data/courses.js
 * (never duplicated by hand -- courses.js is the frozen source of truth). */
export interface InstrumentAnchor {
  instrumentKey: string;
  courseSlug: string;
  courseTitle: string;
  category: string;
  availableLevels: Level[];
  availableAudiences: Audience[];
  excerpt: string;
}

/** A candidate title before it has been scored/persisted. */
export interface TopicCandidate {
  title: string;
  normalizedKey: string;
  instrumentKey: string | null;
  relatedCourseSlug: string | null;
  relatedCourseTitle: string | null;
  category: string | null;
  audience: Audience;
  level: Level;
  modifierType: ModifierType;
  intent: SearchIntent;
  source: string;
}

export interface ScoreBreakdown {
  businessFit: number;
  contentGap: number;
  localRelevance: number;
  intentQuality: number;
  keywordSignal: number;
  freshnessPenalty: number;
}

export interface ScoredCandidate extends TopicCandidate {
  scoreTotal: number;
  scoreBreakdown: ScoreBreakdown;
  reasoning: string;
}

/** A row as stored in / read from the content_topics D1 table. */
export interface ContentTopicRow {
  id: number;
  title: string;
  normalized_key: string;
  instrument_key: string | null;
  related_course_slug: string | null;
  related_course_title: string | null;
  category: string | null;
  audience: string;
  level: string;
  modifier_type: ModifierType;
  intent: SearchIntent;
  score_total: number;
  score_breakdown: string | null;
  reasoning: string | null;
  status: TopicStatus;
  source: string;
  used_by_post_id: number | null;
  run_id: number | null;
  created_at: string;
  updated_at: string;
  used_at: string | null;
}

export interface DiscoveryRunSummary {
  runId: number | null;
  candidatesGenerated: number;
  candidatesAfterDedup: number;
  candidatesApproved: number;
  status: "success" | "failed";
  errorMessage?: string;
}
