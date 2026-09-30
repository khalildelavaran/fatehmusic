// Deduplication logic. Pure functions only -- callers (pipeline.ts) fetch
// existing keys/titles from D1 and pass them in, which keeps this module
// unit-testable without any database.

import { titleSimilarity } from "./normalize";
import { canonicalAssetKey } from "./canonical-identity";
import type { TopicCandidate } from "./types";

// Two titles this similar or higher are treated as the same topic. Tuned
// conservatively (near-exact rewordings only) -- false negatives (a near
// duplicate slipping through) are cheap, since an admin still reviews the
// queue before anything is used; false positives (rejecting a genuinely
// distinct topic) are more costly and harder to notice.
const NEAR_DUPLICATE_THRESHOLD = 0.82;

/** Removes semantic duplicates within a generated batch. Candidates with
 * different wording but the same course/angle/audience/level now share one
 * canonical identity; genuinely different editorial angles remain distinct. */
export function dedupWithinBatch(candidates: TopicCandidate[]): TopicCandidate[] {
  const seenCanonical = new Set<string>();
  const seenNormalized = new Set<string>();
  const out: TopicCandidate[] = [];
  for (const candidate of candidates) {
    const canonicalKey = canonicalAssetKey(candidate);
    if (seenCanonical.has(canonicalKey) || seenNormalized.has(candidate.normalizedKey)) continue;
    seenCanonical.add(canonicalKey);
    seenNormalized.add(candidate.normalizedKey);
    out.push(candidate);
  }
  return out;
}

export interface ExistingTitleIndex {
  normalizedKeys: Set<string>;
  canonicalKeys: Set<string>;
  titles: string[];
  /** Published/drafted blog posts that already occupy the local_shushtar
   * angle for a course. The key is the related course slug. */
  localShushtarCourseSlugs: Set<string>;
}

/** Filters out candidates that already exist (exact normalized key or
 * canonical semantic identity) or are a near-duplicate of an existing title. */
export function filterAgainstExisting(
  candidates: TopicCandidate[],
  existing: ExistingTitleIndex
): TopicCandidate[] {
  return candidates.filter((candidate) => {
    if (existing.normalizedKeys.has(candidate.normalizedKey)) return false;
    if (existing.canonicalKeys.has(canonicalAssetKey(candidate))) return false;

    // blog_posts historically did not store modifier_type, so the DB layer
    // derives this narrowly from the local title/URL semantics. Reserve only
    // the local_shushtar angle for the same course; other editorial angles
    // (how_to, mistakes, benefits, etc.) must remain independently discoverable.
    if (
      candidate.modifierType === "local_shushtar" &&
      !candidate.audience &&
      !candidate.level &&
      candidate.relatedCourseSlug &&
      existing.localShushtarCourseSlugs.has(candidate.relatedCourseSlug)
    ) {
      return false;
    }

    for (const title of existing.titles) {
      if (titleSimilarity(candidate.title, title) >= NEAR_DUPLICATE_THRESHOLD) return false;
    }
    return true;
  });
}

export { NEAR_DUPLICATE_THRESHOLD };
