// Deduplication logic. Pure functions only -- callers (pipeline.ts) fetch
// existing keys/titles from D1 and pass them in, which keeps this module
// unit-testable without any database.

import { titleSimilarity } from "./normalize";
import type { TopicCandidate } from "./types";

// Two titles this similar or higher are treated as the same topic. Tuned
// conservatively (near-exact rewordings only) -- false negatives (a near
// duplicate slipping through) are cheap, since an admin still reviews the
// queue before anything is used; false positives (rejecting a genuinely
// distinct topic) are more costly and harder to notice.
const NEAR_DUPLICATE_THRESHOLD = 0.82;

/** Removes exact-key duplicates that appear more than once within the
 * same generated batch (templates can legitimately collide, e.g. two
 * modifier types producing the same phrase for an edge-case course). */
export function dedupWithinBatch(candidates: TopicCandidate[]): TopicCandidate[] {
  const seen = new Set<string>();
  const out: TopicCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.normalizedKey)) continue;
    seen.add(candidate.normalizedKey);
    out.push(candidate);
  }
  return out;
}

export interface ExistingTitleIndex {
  normalizedKeys: Set<string>;
  titles: string[];
}

/** Filters out candidates that already exist (exact key match) or are a
 * near-duplicate (Jaccard similarity above threshold) of something
 * already in content_topics or already-published/drafted blog_posts. */
export function filterAgainstExisting(
  candidates: TopicCandidate[],
  existing: ExistingTitleIndex
): TopicCandidate[] {
  return candidates.filter((candidate) => {
    if (existing.normalizedKeys.has(candidate.normalizedKey)) return false;
    for (const title of existing.titles) {
      if (titleSimilarity(candidate.title, title) >= NEAR_DUPLICATE_THRESHOLD) return false;
    }
    return true;
  });
}

export { NEAR_DUPLICATE_THRESHOLD };
