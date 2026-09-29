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
import { areIntentsCompatible } from "./content-strategy/policy.js";
import { buildKnowledgeGraph, validateKnowledgeGraph } from "./knowledge-graph.js";
import { buildMarketOpportunityReport, buildMarketSignalMap } from "./market-opportunities.js";
import { buildCompetitiveGapReport } from "./competitive-gaps.js";
import { buildSiteLinkCandidates } from "./site-graph.js";
import { containsSemanticPhrase, normalizeSemanticText } from "../helpers/text.js";
import { isBrandNavigationQuery, isOwnershipEligibleQuery, normalizeQuery } from "../helpers/query.js";
import { findTopic, findCourseForTopic, hasLocalSignal, isShushtarTopic } from "./content-strategy/resolvers.js";

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

function inferTargetEntityFromUrl(url, keyword, courses = []) {
  const value = String(url || "").replace(/\/$/, "");
  if (!value) return null;

  const courseMatch = value.match(/\/courses\/([^/]+)$/i);
  if (courseMatch) {
    const course = courses.find((item) => item?.slug === courseMatch[1]) || null;
    return {
      type: "Course",
      id: value + "/#course",
      name: course?.title || keyword,
      url: value
    };
  }

  if (/\/blog\//i.test(value)) {
    return { type: "Article", id: value + "/#article", name: keyword, url: value };
  }

  if (/\/instructors\//i.test(value)) {
    return { type: "Person", id: value + "/#person", name: keyword, url: value };
  }

  if (/\/locations\/shushtar$/i.test(value)) {
    return { type: "LocalBusiness", id: value + "#localbusiness", name: "آموزش موسیقی در شوشتر", url: value };
  }

  return { type: "WebPage", id: value, name: keyword, url: value };
}

function marketOpportunityInitialAction(item) {
  if (item?.classification === "STRIKING_DISTANCE" || item?.classification === "CTR_OR_RANKING") return "OPTIMIZE_EXISTING";
  if (item?.classification === "CONTENT_EXPANSION") return "EXPAND";
  if (item?.classification === "MARKET_ONLY") return "NEW_CONTENT";
  return null;
}

function buildMarketDiscoveryCandidates(marketOpportunities = [], baseOpportunities = [], courses = [], siteUrl = "") {
  const baseUrl = String(siteUrl || "https://fatehmusic.ir").replace(/\/$/, "");
  const candidates = [];
  const claimed = new Set();

  for (const item of Array.isArray(marketOpportunities) ? marketOpportunities : []) {
    const keyword = String(item?.keyword || "").trim();
    if (!keyword || isBrandNavigationQuery(keyword) || !isOwnershipEligibleQuery(keyword)) continue;
    const marketScore = Number(item?.marketScore) || 0;
    if (marketScore < 30) continue;

    const topics = resolveTopics({ title: keyword, keywords: [keyword], path: "" });
    const topic = topics.find((entry) => entry.slug !== "shushtar" && entry.slug !== "music-education");
    if (!topic) continue;

    const intent = classifyIntent({ title: keyword, keywords: [keyword] }).primary;
    const normalizedKeyword = normalizeQuery(keyword);

    const represented = baseOpportunities
      .filter((opportunity) => opportunity.topic === topic.slug)
      .some((opportunity) => {
        const intents = opportunity.searchIntents || [opportunity.searchIntent];
        if (!intents.includes(intent)) return false;
        return (opportunity.queryAngles || []).some((angle) => normalizeQuery(angle) === normalizedKeyword);
      });

    if (represented || claimed.has(normalizedKeyword)) continue;

    // A topic+intent asset already exists but does not mention this market
    // keyword: enrich its query-angle layer instead of creating another page.
    const sameAssetIndex = baseOpportunities.findIndex((opportunity) => {
      if (opportunity.topic !== topic.slug) return false;
      const intents = opportunity.searchIntents || [opportunity.searchIntent];
      return intents.some((value) => areIntentsCompatible(value, intent));
    });

    if (sameAssetIndex >= 0) continue;

    const course = findCourseForTopic(topic, courses, keyword);
    const initialAction = marketOpportunityInitialAction(item);
    if (!initialAction) continue;

    const isLocal = hasLocalSignal(keyword) || isShushtarTopic(topic);
    const bestUrl = item.bestPositionUrl ? String(item.bestPositionUrl) : "";
    const targetEntity = inferTargetEntityFromUrl(bestUrl, keyword, courses);
    const existingArticleSlugs = targetEntity?.type === "Article"
      ? [targetEntity.url.split("/blog/")[1] || ""]
      : [];

    claimed.add(normalizedKeyword);
    candidates.push({
      title: keyword,
      normalizedKey: normalizedKeyword,
      instrumentKey: topic.slug,
      relatedCourseSlug: course?.slug || null,
      relatedCourseTitle: course?.title || null,
      intent,
      source: "market-discovery",
      modifierType: "market_discovery",
      audience: "",
      level: "",
      scoreTotal: Math.max(35, Math.min(90, 25 + Math.round(marketScore * 0.65))),
      initialAction,
      initialTargetEntity: targetEntity,
      initialExistingArticleSlugs: existingArticleSlugs,
      marketDiscovery: true,
      marketClassification: item.classification || null,
      marketBestPosition: item.bestPosition,
      marketBestPositionUrl: bestUrl || null,
      marketScore,
      marketQueryAngles: [keyword],
      rationale: `این فرصت از دادهٔ بازار Ahrefs برای «${keyword}» کشف شده و پیش از ایجاد دارایی جدید با موضوعات موجود بررسی شده است.`
    });
  }

  return candidates;
}

function mergeMarketAnglesIntoExistingOpportunities(opportunities = [], marketOpportunities = []) {
  return opportunities.map((opportunity) => {
    const additions = marketOpportunities
      .filter((item) => {
        const topic = String(item?.topic || "");
        if (!topic || topic !== opportunity.topic) return false;
        const intent = classifyIntent({ title: item.keyword, keywords: [item.keyword] }).primary;
        const intents = opportunity.searchIntents || [opportunity.searchIntent];
        return intents.some((value) => areIntentsCompatible(value, intent));
      })
      .map((item) => item.keyword)
      .filter(Boolean);

    if (!additions.length) return opportunity;

    return Object.freeze({
      ...opportunity,
      queryAngles: Object.freeze([...new Set([...(opportunity.queryAngles || []), ...additions])].slice(0, 15)),
      marketQueryAngles: Object.freeze([...new Set(additions)].slice(0, 10))
    });
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
 * @param {{posts?: object[], courses?: object[], instructors?: object[], topicCandidates?: object[], gscRows?: object[], gscDataQuality?: object, marketDataQuality?: object, marketSignals?: object[]|Map|string, marketKeywordRows?: object[], competitorKeywordRows?: object[], targetKeywordRows?: object[], targetQueries?: string[], siteUrl?: string}} options
 */
export function buildSEOIntelligence({ posts = [], courses = [], instructors = [], topicCandidates = [], gscRows = [], gscDataQuality = {}, marketDataQuality = {}, marketSignals = [], marketKeywordRows = [], competitorKeywordRows = [], targetKeywordRows = [], targetQueries = [], siteUrl = "", gscIndex = null, maxQueryClusters = 5000, maxOwnershipQueries = 5000, includeKnowledgeGraph = true, includeSemanticLinks = true } = {}) {
  const resolvedSiteUrl = String(siteUrl || "https://fatehmusic.ir").replace(/\/$/, "");
  const cluster = buildContentClusterReport(posts, { courses, siteUrl: resolvedSiteUrl });
  const cleanCandidates = filterStaleBroadCourseCandidates(topicCandidates, courses);
  const pages = articleSemantics(posts, resolvedSiteUrl);
  const marketOpportunities = buildMarketOpportunityReport({
    keywordRows: marketKeywordRows,
    gscRows: currentScoringRows(gscRows),
    gscFreshness: gscDataQuality?.freshness || "UNKNOWN"
  });

  const preliminaryBase = buildUnifiedContentOpportunities({
    gaps: cluster.gaps,
    topicCandidates: cleanCandidates,
    courses,
    siteUrl: resolvedSiteUrl
  });
  const marketAdjustedBase = mergeMarketAnglesIntoExistingOpportunities(
    preliminaryBase.opportunities,
    marketOpportunities
  );
  const marketCandidates = buildMarketDiscoveryCandidates(
    marketOpportunities,
    marketAdjustedBase,
    courses,
    resolvedSiteUrl
  );
  const marketDerived = buildUnifiedContentOpportunities({
    gaps: [],
    topicCandidates: marketCandidates,
    courses,
    siteUrl: resolvedSiteUrl
  });
  const base = Object.freeze({
    opportunities: Object.freeze([
      ...marketAdjustedBase,
      ...marketDerived.opportunities
    ])
  });

  const marketSignalMap = buildMarketSignalMap(marketOpportunities);
  const currentRowsForGapBaseline = currentScoringRows(gscRows);
  const competitorGaps = buildCompetitiveGapReport({
    competitorKeywordRows,
    // External market keywords are opportunities, not proof of first-party coverage.
    targetKeywordRows,

    targetQueries: [
      ...targetQueries,
      ...currentRowsForGapBaseline.map((row) => row?.query).filter(Boolean)
    ]
  });
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
    marketDataQuality,
    competitorGaps,
    marketSignals: mergedMarketSignals,
    gscIndex,
    maxQueryClusters,
    maxOwnershipQueries
  });
  const articleNodes = includeSemanticLinks ? pages.map((page) => ({
    url: page.url,
    title: page.title,
    type: "Article",
    topics: page.topics,
    priority: 12,
    local: page.local ?? true
  })) : [];
  const siteNodes = includeSemanticLinks ? buildSiteLinkCandidates(
    {
      url: resolvedSiteUrl,
      name: "آموزشگاه موسیقی فاتح",
      keywords: ["آموزش موسیقی", "آموزشگاه موسیقی", "شوشتر"]
    },
    { courses, instructors }
  ) : [];
  const currentGscRows = currentScoringRows(gscRows);
  const effectiveGscIndex = search?.index || gscIndex || buildGscSignalIndex(currentGscRows, {
    queryClusterLimit: maxQueryClusters
  });

  const graphNodeMap = new Map();
  if (includeSemanticLinks) {
    for (const node of [...siteNodes, ...articleNodes]) {
      if (!node?.url || graphNodeMap.has(node.url)) continue;
      graphNodeMap.set(node.url, node);
    }
  }
  const pageNodes = [...graphNodeMap.values()];
  const cannibalization = search.cannibalization || [];
  const semanticCannibalization = search.semanticCannibalization || [];
  const temporalCannibalization = search.temporalCannibalization || [];
  const semanticTemporalCannibalization = search.semanticTemporalCannibalization || [];
  const opportunities = search.opportunities;
  const evidenceStrengthAverage = opportunities.length
    ? Math.round(opportunities.reduce((sum, item) => sum + Number(item.evidenceStrengthScore ?? item.decisionConfidence ?? 0), 0) / opportunities.length)
    : 0;
  // Backward-compatible alias: this value is an evidence score, not a probability.
  const decisionConfidenceAverage = evidenceStrengthAverage;
  const knowledgeGraph = includeKnowledgeGraph ? buildKnowledgeGraph({
    siteUrl: resolvedSiteUrl,
    courses,
    instructors,
    posts
  }) : null;
  const knowledgeGraphValidation = knowledgeGraph
    ? validateKnowledgeGraph(knowledgeGraph)
    : Object.freeze({ valid: true, errors: Object.freeze([]), skipped: true });
  const semanticLinks = includeSemanticLinks && knowledgeGraph
    ? buildLinkGraph(pageNodes, {
        semanticGraph: knowledgeGraph,
        gscSignals: effectiveGscIndex.byPageNonBrand,
        gscOwnership: search.queryOwnership
      })
    : []; 

  return Object.freeze({
    cluster,
    pages: freeze(pages),
    gsc: Object.freeze({
      connected: search.connected,
      signalRowCount: search.signalRowCount,
      index: effectiveGscIndex,
      cannibalization: freeze(cannibalization),
      semanticCannibalization: freeze(semanticCannibalization),
      temporalCannibalization: freeze(temporalCannibalization),
      semanticTemporalCannibalization: freeze(semanticTemporalCannibalization),
      queryOwnership: freeze(search.queryOwnership),
      queryOwnershipTotalCount: Number(search.summary?.queryOwnershipTotalCount || search.queryOwnership?.length || 0),
      queryOwnershipLimit: Number(search.summary?.queryOwnershipLimit || search.queryOwnership?.length || 0),
      queryOwnershipTruncated: Boolean(search.summary?.queryOwnershipTruncated),
      queryClusterTotalCount: Number(search.summary?.queryClusterTotalCount || search.queryClusters?.length || 0),
      queryClusterLimit: Number(search.summary?.queryClusterLimit || search.queryClusters?.length || 0),
      queryClusterTruncated: Boolean(search.summary?.queryClusterTruncated),
      queryClusters: freeze(search.queryClusters || [])
    }),
    links: Object.freeze({ graph: freeze(semanticLinks) }),
    knowledgeGraph,
    knowledgeGraphValidation,
    marketOpportunities: freeze(marketOpportunities),
    competitorGaps: freeze(competitorGaps),
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
      queryOwnershipTotalCount: Number(search.summary?.queryOwnershipTotalCount || search.queryOwnership?.length || 0),
      queryOwnershipLimit: Number(search.summary?.queryOwnershipLimit || search.queryOwnership?.length || 0),
      queryOwnershipTruncated: Boolean(search.summary?.queryOwnershipTruncated),
      queryClusterCount: search.queryClusters?.length || 0,
      queryClusterTotalCount: Number(search.summary?.queryClusterTotalCount || search.queryClusters?.length || 0),
      queryClusterLimit: Number(search.summary?.queryClusterLimit || search.queryClusters?.length || 0),
      queryClusterTruncated: Boolean(search.summary?.queryClusterTruncated),
      evidenceStrengthAverage,
      decisionConfidenceAverage,
      knowledgeGraphNodeCount: knowledgeGraph.statistics.nodeCount,
      knowledgeGraphEdgeCount: knowledgeGraph.statistics.edgeCount,
      knowledgeGraphValid: knowledgeGraphValidation.valid,
      gscCompleteness: search.dataQuality?.completeness || 0,
      gscCoverageStatus: search.dataQuality?.coverageStatus || "EMPTY",
      gscFreshness: search.dataQuality?.freshness || "UNKNOWN",
      gscAgeDays: search.dataQuality?.ageDays ?? null,
      marketFreshness: search.marketDataQuality?.freshness || "UNKNOWN",
      marketAgeDays: search.marketDataQuality?.ageDays ?? null,
      marketSignalCount: search.marketDataQuality?.signalCount || 0,
      marketOpportunityCount: marketOpportunities.length,
      competitorGapCount: competitorGaps.length,
      competitorGapBackedCount: opportunities.filter((item) => item.competitorGap?.available).length
    })
  });
}
