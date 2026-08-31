/**
 * Unified SEO/GEO orchestrator.
 * Composes existing engines; it does not duplicate topic, intent, GSC,
 * content-strategy, internal-link, or entity-graph logic.
 */
import { buildContentClusterReport, buildArticleProfiles } from "./content-clusters.js";
import { buildUnifiedContentOpportunities } from "./content-strategy.js";
import { enrichOpportunitiesWithSearchConsole } from "./gsc-intelligence.js";
import { buildGscSignalIndex, detectSearchCannibalization } from "./gsc-signal-resolver.js";
import { buildLinkGraph } from "./internal-links.js";
import { scoreOpportunities } from "./opportunity-scoring.js";
import { resolveTopics } from "./topics.js";
import { classifyIntent } from "./intents.js";
import { auditPage } from "./audit.js";

function freezeArray(items) { return Object.freeze(Array.isArray(items) ? items : []); }

function buildPageSemantics(posts = []) {
  return buildArticleProfiles(posts).map((page) => Object.freeze({
    ...page,
    topics: freezeArray(page.topics),
    topicDetails: freezeArray(resolveTopics({ title: page.title, keywords: [page.title], path: `/blog/${page.slug}` })),
    intentDetails: classifyIntent({ path: `/blog/${page.slug}`, title: page.title, keywords: [page.title], entityType: "Article" })
  }));
}

/**
 * Compose the current SEO/GEO subsystems into one deterministic view model.
 * @param {{posts?:Array,courses?:Array,topicCandidates?:Array,gscRows?:Array,siteUrl?:string,auditContext?:object}} input
 */
export function buildSEOIntelligence({ posts = [], courses = [], topicCandidates = [], gscRows = [], siteUrl, auditContext = {} } = {}) {
  const clusterReport = buildContentClusterReport(posts, { courses, siteUrl });
  const base = buildUnifiedContentOpportunities({
    gaps: clusterReport.gaps,
    topicCandidates,
    courses,
    siteUrl
  });

  const search = enrichOpportunitiesWithSearchConsole(base.opportunities, gscRows);
  const pages = buildPageSemantics(posts);
  const linkGraph = buildLinkGraph(pages.map((page) => ({
    url: `${siteUrl || ""}/blog/${encodeURIComponent(page.slug)}`,
    title: page.title,
    type: "Article",
    topics: page.topics,
    priority: 12,
    local: true
  })));
  const gscIndex = buildGscSignalIndex(gscRows);
  const cannibalization = detectSearchCannibalization(gscRows);

  const scored = scoreOpportunities(search.opportunities);
  const audit = auditPage({
    metadata: { title: "SEO/GEO Intelligence", description: "Unified SEO/GEO engine view", robots: "index" },
    url: siteUrl || "",
    schemaGraph: { "@graph": [] },
    indexable: true,
    topicSlugs: [...new Set(pages.flatMap((page) => page.topics || []))],
    primaryIntent: "",
    freshness: { status: "unknown" },
    ...auditContext
  });

  return Object.freeze({
    cluster: clusterReport,
    pages: freezeArray(pages),
    gsc: Object.freeze({
      connected: search.connected,
      signalRowCount: search.signalRowCount,
      index: gscIndex,
      cannibalization: freezeArray(cannibalization)
    }),
    links: Object.freeze({ graph: freezeArray(linkGraph) }),
    opportunities: freezeArray(scored),
    summary: Object.freeze({
      opportunityCount: scored.length,
      highPriorityCount: scored.filter((item) => item.priority >= 85).length,
      newContentCount: scored.filter((item) => item.action === "NEW_CONTENT").length,
      optimizeCount: scored.filter((item) => item.action === "OPTIMIZE_EXISTING").length,
      expandCount: scored.filter((item) => item.action === "EXPAND").length,
      mergeCount: scored.filter((item) => item.action === "MERGE_CONTENT").length,
      linkCount: scored.filter((item) => item.action === "LINK").length,
      searchBackedCount: scored.filter((item) => item.searchSignal?.available).length,
      cannibalizationCount: cannibalization.length
    }),
    audit
  });
}
