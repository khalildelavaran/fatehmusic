/**
 * Unified SEO/GEO orchestration layer.
 * Composes existing engines; does not duplicate their rules.
 */
import { buildContentClusterReport, buildArticleProfiles } from "./content-clusters.js";
import { buildUnifiedContentOpportunities } from "./content-strategy.js";
import { enrichOpportunitiesWithSearchConsole, currentScoringRows } from "./gsc-intelligence.js";
import { buildGscSignalIndex } from "./gsc-signal-resolver.js";
import { buildLinkGraph } from "./internal-links.js";
import { resolveTopics } from "./topics.js";
import { classifyIntent } from "./intents.js";
import { buildKnowledgeGraph, validateKnowledgeGraph } from "./knowledge-graph.js";
import { buildMarketOpportunityReport, buildMarketSignalMap } from "./market-opportunities.js";
import { buildSiteLinkCandidates } from "./site-graph.js";
import { containsSemanticPhrase, normalizeSemanticText } from "../helpers/text.js";

const freeze = (value) => Object.freeze(Array.isArray(value) ? value : []);

function normalize(value) { return normalizeSemanticText(value); }

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
      const explicitlyNamesCourse = courseTopic && containsSemanticPhrase(title, courseTopic);
      const explicitlyNamesCourseTitle = courseName && containsSemanticPhrase(title, courseName);
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

/**
 * Compose all existing SEO/GEO intelligence into one dashboard-ready model.
 * @param {{posts?: object[], courses?: object[], instructors?: object[], topicCandidates?: object[], gscRows?: object[], gscDataQuality?: object, marketSignals?: object[]|Map|string, marketKeywordRows?: object[], siteUrl?: string}} options
 */
export function buildSEOIntelligence({ posts = [], courses = [], instructors = [], topicCandidates = [], gscRows = [], gscDataQuality = {}, marketSignals = [], marketKeywordRows = [], siteUrl = "" } = {}) {
  const cluster = buildContentClusterReport(posts, { courses, siteUrl });
  const cleanCandidates = filterStaleBroadCourseCandidates(topicCandidates, courses);
  const base = buildUnifiedContentOpportunities({ gaps: cluster.gaps, topicCandidates: cleanCandidates, courses, siteUrl });
  const pages = articleSemantics(posts, siteUrl);
  const marketOpportunities = buildMarketOpportunityReport({
    keywordRows: marketKeywordRows,
    gscRows: currentScoringRows(gscRows)
  });
  const marketSignalMap = buildMarketSignalMap(marketOpportunities);
  const mergedMarketSignals = new Map(marketSignalMap);
  if (marketSignals instanceof Map) {
    for (const [key, value] of marketSignals.entries()) mergedMarketSignals.set(key, value);
  } else if (Array.isArray(marketSignals)) {
    for (const item of marketSignals) {
      if (item?.keyword) mergedMarketSignals.set(normalize(item.keyword), item);
    }
  } else if (marketSignals && typeof marketSignals === "object") {
    for (const [key, value] of Object.entries(marketSignals)) {
      mergedMarketSignals.set(normalize(key), value);
    }
  }
  const search = enrichOpportunitiesWithSearchConsole(base.opportunities, gscRows, {
    pageSemantics: pages,
    gscDataQuality,
    marketSignals: mergedMarketSignals
  });
  const articleNodes = pages.map((page) => ({
    url: page.url,
    title: page.title,
    type: "Article",
    topics: page.topics,
    priority: 12,
    local: page.local ?? true
  }));
  const siteNodes = buildSiteLinkCandidates(
    {
      url: siteUrl,
      name: "آموزشگاه موسیقی فاتح",
      keywords: ["آموزش موسیقی", "آموزشگاه موسیقی", "شوشتر"]
    },
    { courses, instructors }
  );
  const graphNodeMap = new Map();
  for (const node of [...siteNodes, ...articleNodes]) {
    if (!node?.url || graphNodeMap.has(node.url)) continue;
    graphNodeMap.set(node.url, node);
  }
  const pageNodes = [...graphNodeMap.values()];
  const currentGscRows = currentScoringRows(gscRows);
  const gscIndex = buildGscSignalIndex(currentGscRows);
  const cannibalization = search.cannibalization || [];
  const semanticCannibalization = search.semanticCannibalization || [];
  const temporalCannibalization = search.temporalCannibalization || [];
  const semanticTemporalCannibalization = search.semanticTemporalCannibalization || [];
  const opportunities = search.opportunities;
  const decisionConfidenceAverage = opportunities.length
    ? Math.round(opportunities.reduce((sum, item) => sum + Number(item.decisionConfidence || 0), 0) / opportunities.length)
    : 0;
  const knowledgeGraph = buildKnowledgeGraph({
    siteUrl,
    courses,
    instructors,
    posts
  });
  const knowledgeGraphValidation = validateKnowledgeGraph(knowledgeGraph);
  const semanticLinks = buildLinkGraph(pageNodes, { semanticGraph: knowledgeGraph });

  return Object.freeze({
    cluster,
    pages: freeze(pages),
    gsc: Object.freeze({
      connected: search.connected,
      signalRowCount: search.signalRowCount,
      index: gscIndex,
      cannibalization: freeze(cannibalization),
      semanticCannibalization: freeze(semanticCannibalization),
      temporalCannibalization: freeze(temporalCannibalization),
      semanticTemporalCannibalization: freeze(semanticTemporalCannibalization),
      queryOwnership: freeze(search.queryOwnership),
      queryClusters: freeze(search.queryClusters || [])
    }),
    links: Object.freeze({ graph: freeze(semanticLinks) }),
    knowledgeGraph,
    knowledgeGraphValidation,
    marketOpportunities: freeze(marketOpportunities),
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
      marketBackedCount: opportunities.filter((item) => item.marketSignal?.available).length,
      cannibalizationCount: cannibalization.length,
      semanticCannibalizationCount: semanticCannibalization.length,
      semanticCannibalizationActionableCount: semanticCannibalization.filter((item) => item.actionable).length,
      temporalCannibalizationCount: temporalCannibalization.length,
      semanticTemporalCannibalizationCount: semanticTemporalCannibalization.length,
      semanticTemporalCannibalizationActionableCount: semanticTemporalCannibalization.filter((item) => item.actionable).length,
      temporalActionableCount: temporalCannibalization.filter((item) => item.actionable).length,
      queryOwnershipCount: search.queryOwnership?.length || 0,
      queryClusterCount: search.queryClusters?.length || 0,
      decisionConfidenceAverage,
      knowledgeGraphNodeCount: knowledgeGraph.statistics.nodeCount,
      knowledgeGraphEdgeCount: knowledgeGraph.statistics.edgeCount,
      knowledgeGraphValid: knowledgeGraphValidation.valid,
      gscCompleteness: search.dataQuality?.completeness || 0,
      gscFreshness: search.dataQuality?.freshness || "UNKNOWN",
      gscAgeDays: search.dataQuality?.ageDays ?? null,
      marketOpportunityCount: marketOpportunities.length
    })
  });
}
