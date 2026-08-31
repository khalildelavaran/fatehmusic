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
  const base = buildUnifiedContentOpportunities({ gaps: cluster.gaps, topicCandidates, courses, siteUrl });
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
