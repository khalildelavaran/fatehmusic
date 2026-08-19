// Candidate title generation: combines real course data (courses.js,
// the frozen source of truth -- never duplicated by hand) with the
// hand-written templates in src/data/content-engine-seeds.ts.
//
// Deliberately deterministic (no LLM call): every candidate here is
// reproducible, instantly testable, and free to generate. LLM-assisted
// *semantic expansion* beyond this fixed template space is a documented
// future step (see doc/ADR/ADR-011), not part of this slice.

import { courses } from "../../data/courses.js";
import {
  MODIFIER_TEMPLATES,
  MODIFIER_AUDIENCE_RULES,
  COMPARISON_PAIRS,
  GENERAL_EVERGREEN_TOPICS
} from "../../data/content-engine-seeds";
import { normalizePersianText, toDedupKey } from "./normalize";
import type { Audience, Level, ModifierType, TopicCandidate, InstrumentAnchor } from "./types";

// Minimal shape actually read from courses.js -- intentionally not
// importing the project's Course type (src/types/courses.ts), since this
// module only ever touches these specific fields.
interface CourseLike {
  slug: string;
  title: string;
  active: boolean;
  instrument: string;
  category: string;
  level?: string[];
  ageGroup?: string[];
  content?: { excerpt?: string };
}

const ALL_AUDIENCES: Audience[] = ["کودک", "نوجوان", "بزرگسال"];

// Modifier types where a category-level mismatch would make the
// generated title nonsensical (see ADR-011 for the reasoning per case).
const CATEGORY_EXCLUDED_MODIFIERS: Record<string, ModifierType[]> = {
  "آواز": ["buying_guide"],
  "دروس پایه موسیقی": ["buying_guide", "theory_link"],
  "آموزش کودک": ["buying_guide", "career_path"]
};

// Modifiers handled per-course by the main loop below (comparison and
// evergreen_general are generated separately, not per single course).
const PER_COURSE_MODIFIERS: ModifierType[] = [
  "how_to", "mistakes", "buying_guide", "practice_tips",
  "theory_link", "parent_guide", "local_shushtar", "age_specific",
  "benefits", "career_path"
];

/** "آموزش گیتار" -> "گیتار", "دوره سلفژ" -> "سلفژ". Only strips a known,
 * literal prefix already present in the frozen data -- never invents a name. */
export function derivePlainName(courseTitle: string): string {
  return normalizePersianText(courseTitle).replace(/^(آموزش|دوره)\s+/, "").trim() || courseTitle;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function buildAnchor(course: CourseLike): InstrumentAnchor {
  return {
    instrumentKey: course.instrument,
    courseSlug: course.slug,
    courseTitle: course.title,
    category: course.category,
    availableLevels: (course.level ?? []) as Level[],
    availableAudiences: (course.ageGroup ?? []) as Audience[],
    excerpt: course.content?.excerpt ?? ""
  };
}

/** Reads the live, active course list from courses.js. Exported so the
 * admin UI / scoring engine can show "N courses have zero topics yet". */
export function getInstrumentAnchors(): InstrumentAnchor[] {
  return (courses as CourseLike[]).filter((c) => c.active).map(buildAnchor);
}

function candidateFrom(
  title: string,
  anchor: InstrumentAnchor | null,
  audience: Audience,
  level: Level,
  modifierType: ModifierType,
  intent: TopicCandidate["intent"]
): TopicCandidate {
  const clean = normalizePersianText(title);
  return {
    title: clean,
    normalizedKey: toDedupKey(clean),
    instrumentKey: anchor?.instrumentKey ?? null,
    relatedCourseSlug: anchor?.courseSlug ?? null,
    relatedCourseTitle: anchor?.courseTitle ?? null,
    category: anchor?.category ?? null,
    audience,
    level,
    modifierType,
    // Provisional; the real classifier in intent.ts overrides this once
    // the candidate is scored -- kept here only as a sensible default.
    intent,
    source: "seed_generator"
  };
}

function generateForCourse(anchor: InstrumentAnchor): TopicCandidate[] {
  const out: TopicCandidate[] = [];
  const name = derivePlainName(anchor.courseTitle);
  const excludedForCategory = CATEGORY_EXCLUDED_MODIFIERS[anchor.category] ?? [];
  const courseAudiences: Audience[] = anchor.availableAudiences.length
    ? anchor.availableAudiences
    : ALL_AUDIENCES;

  for (const modifierType of PER_COURSE_MODIFIERS) {
    if (excludedForCategory.includes(modifierType)) continue;
    const allowedAudiences = MODIFIER_AUDIENCE_RULES[modifierType];
    const templates = MODIFIER_TEMPLATES[modifierType];
    if (!templates.length) continue;

    if (modifierType === "age_specific") {
      // One candidate per audience this course actually serves.
      for (const audience of courseAudiences) {
        const idx = ALL_AUDIENCES.indexOf(audience);
        const template = templates[idx] ?? templates[0];
        out.push(candidateFrom(fillTemplate(template, { name }), anchor, audience, "", modifierType, "informational"));
      }
      continue;
    }

    // Non-audience-specific variant (audience === "") if the modifier allows it.
    if (allowedAudiences.includes("")) {
      const template = templates[0];
      const level: Level = modifierType === "how_to" || modifierType === "practice_tips" ? "مبتدی" : "";
      out.push(candidateFrom(fillTemplate(template, { name }), anchor, "", level, modifierType, "informational"));
    }

    // Audience-specific variants, only for audiences this course serves
    // AND this modifier is allowed to target directly.
    for (const audience of courseAudiences) {
      if (!allowedAudiences.includes(audience)) continue;
      const template = templates[templates.length > 1 ? 1 : 0];
      out.push(candidateFrom(fillTemplate(template, { name }), anchor, audience, "", modifierType, "informational"));
    }
  }
  return out;
}

function generateComparisons(anchors: Map<string, InstrumentAnchor>): TopicCandidate[] {
  const templates = MODIFIER_TEMPLATES.comparison;
  const out: TopicCandidate[] = [];
  COMPARISON_PAIRS.forEach(([slugA, slugB], idx) => {
    const a = anchors.get(slugA);
    const b = anchors.get(slugB);
    if (!a || !b) return; // course inactive/renamed -- skip rather than guess
    const template = templates[idx % templates.length];
    const title = fillTemplate(template, { name: derivePlainName(a.courseTitle), name2: derivePlainName(b.courseTitle) });
    // Comparison titles legitimately span two courses; store the first as
    // the "related" course and keep both names inside the title itself.
    out.push(candidateFrom(title, a, "", "", "comparison", "commercial"));
  });
  return out;
}

function generateEvergreen(): TopicCandidate[] {
  return GENERAL_EVERGREEN_TOPICS.map((title) => candidateFrom(title, null, "", "", "evergreen_general", "informational"));
}

/** The full candidate pool for one discovery run. Pure function -- no
 * D1/network access, so it is trivially unit-testable and side-effect-free.
 * Dedup against what already exists happens one layer up, in pipeline.ts. */
export function generateCandidates(): TopicCandidate[] {
  const anchors = getInstrumentAnchors();
  const anchorBySlug = new Map(anchors.map((a) => [a.courseSlug, a]));
  const perCourse = anchors.flatMap(generateForCourse);
  const comparisons = generateComparisons(anchorBySlug);
  const evergreen = generateEvergreen();
  return [...perCourse, ...comparisons, ...evergreen];
}
