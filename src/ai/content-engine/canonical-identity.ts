import { toDedupKey } from "./normalize";
import type { TopicCandidate } from "./types";

/**
 * Stable semantic identity for a generated topic.
 *
 * Intent is deliberately excluded: informational/commercial/transactional
 * are search signals, not separate content assets. The modifier, audience,
 * level and course anchor define the editorial angle instead.
 *
 * For comparison and evergreen topics the title remains part of the identity
 * because those candidates are intentionally not anchored to one course.
 */
export function canonicalAssetKey(candidate: Pick<
  TopicCandidate,
  "title" | "relatedCourseSlug" | "instrumentKey" | "modifierType" | "audience" | "level"
>): string {
  const course = candidate.relatedCourseSlug || candidate.instrumentKey || "general";
  const audience = candidate.audience || "general";
  const level = candidate.level || "general";

  if (candidate.modifierType === "comparison" || candidate.modifierType === "evergreen_general") {
    return ["v1", candidate.modifierType, toDedupKey(candidate.title)].join("|");
  }

  return [
    "v1",
    course,
    candidate.modifierType,
    audience,
    level
  ].join("|");
}
