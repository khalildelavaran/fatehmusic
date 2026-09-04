/**
 * Unified SEO/GEO orchestration layer.
 * Composes existing engines; does not duplicate their rules.
 */
import { buildContentClusterReport, buildArticleProfiles } from "./content-clusters.js";
import { buildUnifiedContentOpportunities } from "./content-strategy.js";
import { enrichOpportunitiesWithSearchConsole } from "./gsc-intelligence.js";
import { buildGscSignalIndex, detectSearchCannibalization } from "./gsc-signal-resolver.js";
import { detectTemporalCannibalization } from "./gsc-temporal.js";
import { buildLinkGraph } from "./internal-links.js";
import { scoreOpportunities } from "./opportunity-scoring.js";
import { resolveTopics } from "./topics.js";
import { classifyIntent } from "./intents.js";

const freeze = (value) => Object.freeze(Array.isArray(value) ? value : []);

function normalize(value) {
  return String(value ?? "")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\s\-_]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Stored topic-engine candidates can outlive the rules that generated them.
 * A broad title such as «آموزش موسیقی در شوشتر» must never inherit a
 * specific course merely because an old DB row contains relatedCourseSlug.
 * Subject-specific titles (for example «کلاس آواز در شوشتر») are retained.
 */
function filterStaleBroadCourseCandidates(candidates = [], courses = []) {
  const courseBySlug = new Map(courses.filter((course) => course?.slug).map((course) => [course.slug, course]));

  return candidates.filter((candidate) => {
    if (!candidate?.relatedCourseSlug) return true;
    const course = courseBySlug.get(candidate.relatedCourseSlug);
    if (!course) return true;

    const title = normalize(candidate.title);
    const courseTopic = normalize(course.instrument || "");
    const courseName = normalize(course.title || "");
    const resolved = resolveTopics({ title: candidate.title, keywords: [candidate.title], path: "" });
    const resolvedSubjects = resolved.filter((topic) => topic.slug !== "shushtar" && topic.slug !== "music-education");

    // If the title resolves only to a broad/local topic, the course relation
    // is stale and would otherwise turn a general opportunity into a child
    // course opportunity (the exact source of the duplicate queue entries).
    if (resolvedSubjects.length === 0) {
      const explicitlyNamesCourse = courseTopic && title.includes(courseTopic);
      const explicitlyNamesCourseTitle = courseName && title.includes(courseName);
      if (!explicitlyNamesCourse && !explicitlyNamesCourseTitle) return false;
    }

    return true;
  });
}

function articleSemantics(posts = [], siteUrl = "") {
  const base = String(siteUrl).replace(/\/$/, "");
  return buildArticleProfiles(posts).map((page) => Object.freeze({
    ...page,
    url: `${base}/blog/${encodeURIComponent(page.slug)}`,
    topics: freeze(page.topics),
    topicDetails: freeze(resolveTopics({ title: page.title, keywords: [page.title], path: `/blog/${page.slug}` })),
    intentDetails: classifyIntent({ path: `/blog/${page.slug}`, title: page.title, keywords: [page.title], entityType: "Article" }),
    entity: "Article"
  }));
}

/** Compose all existing SEO/GEO intelligence into one dashboard-ready model. */
export function buildSEOIntelligence({ posts = [], courses = [], topicCandidates = [], gscRows = [], siteUrl = "" } = {}) {
  const cluster = buildContentClusterReport(posts, { courses, siteUrl });
  const cleanCandidates = filterStaleBroadCourseCandidates(topicCandidates, courses);
  const base = buildUnifiedContentOpportunities({ gaps: cluster.gaps, topicCandidates: cleanCandidates, courses, siteUrl });
  const pages = articleSemantics(posts, siteUrl);
  const search = enrichOpportunitiesWithSearchConsole(base.opportunities, gscRows, { pageSemantics: pages });
  const pageNodes = pages.map((page) => ({ url: page.url, title: page.title, type: "Article", topics: page.topics, priority: 12, local: true }));
  const gscIndex = buildGscSignalIndex(gscRows);
  const cannibalization = detectSearchCannibalization(gscRows, { pageSemantics: pages });
  const temporalCannibalization = search.temporalCannibalization || detectTemporalCannibalization(gscRows);
  const opportunities = scoreOpportunities(search.opportunities);

  return Object.freeze({
    cluster,
    pages: freeze(pages),
    gsc: Object.freeze({
      connected: search.connected,
      signalRowCount: search.signalRowCount,
      index: gscIndex,
      cannibalization: freeze(cannibalization),
      temporalCannibalization: freeze(temporalCannibalization)
    }),
    links: Object.freeze({ graph: freeze(buildLinkGraph(pageNodes)) }),
    opportunities: freeze(opportunities),
    summary: Object.freeze({
      opportunityCount: opportunities.length,
      highPriorityCount: opportunities.filter((item) => item.priority >= 85).length,
      newContentCount: opportunities.filter((item) => item.action === "NEW_CONTENT").length,
      optimizeCount: opportunities.filter((item) => item.action === "OPTIMIZE_EXISTING").length,
      expandCount: opportunities.filter((item) => item.action === "EXPAND").length,
      mergeCount: opportunities.filter((item) => item.action === "MERGE_CONTENT").length,
      linkCount: opportunities.filter((item) => item.action === "LINK").length,
      searchBackedCount: opportunities.filter((item) => item.searchSignal?.available).length,
      cannibalizationCount: cannibalization.length,
      temporalCannibalizationCount: temporalCannibalization.length,
      temporalActionableCount: temporalCannibalization.filter((item) => item.actionable).length
    })
  });
}
