/**
 * Fateh Music Academy — SEO/GEO Engine v2 public entry point.
 */
import { resolveSite } from "./resolvers/site.js";
import { resolveCourse } from "./resolvers/course.js";
import { resolveInstructor } from "./resolvers/instructor.js";
import { buildMetadata } from "./builders/metadata.js";
import { buildCanonical } from "./builders/canonical.js";
import { buildOpenGraph } from "./builders/openGraph.js";
import { buildTwitter } from "./builders/twitter.js";
import { buildOrganizationSchema } from "./schema/organization.js";
import { buildWebsiteSchema } from "./schema/website.js";
import { buildWebPageSchema } from "./schema/webpage.js";
import { buildSchemaGraph } from "./schema/graph.js";
import { compileKnowledgeGraphEdges } from "./schema/compiler.js";
import { SCHEMA_REGISTRY, isKnownSchemaType, getSchemaTypeDefinition, validateSchemaTypes, schemaRegistryStatistics } from "./schema/registry.js";
import { buildTopicSchemas } from "./schema/topic.js";
import { buildLocalPlaceSchema } from "./schema/local-place.js";
import { buildCourseSchema, buildCourseStyleSchemas, buildGuitarStyleSchema } from "./schema/course.js";
import { buildPersonSchema } from "./schema/person.js";
import { buildProfilePageSchema } from "./schema/profilePage.js";
import { buildArticleSchema } from "./schema/article.js";
import { buildVideoSchema } from "./schema/video.js";
import { buildBreadcrumbSchema } from "./schema/breadcrumb.js";
import { buildFaqSchema } from "./schema/faq.js";
import { buildItemListSchema } from "./schema/itemlist.js";
import { buildImageGallerySchema } from "./schema/image-gallery.js";
import { buildAboutPageSchema } from "./schema/aboutpage.js";
import { buildContactPageSchema } from "./schema/contactpage.js";
import { absoluteUrl } from "./helpers/url.js";
import { normalizeQuery, queryTokens, isBrandNavigationQuery, isOwnershipEligibleQuery } from "./helpers/query.js";
import { isPrivateRoute } from "./helpers/private-route.js";
import { courses } from "../data/courses.js";
import { instructors } from "../data/instructors.js";
import { resolveTopics, topicSlugs } from "./v2/topics.js";
import { classifyIntent } from "./v2/intents.js";
import { getFreshness } from "./v2/freshness.js";
import { buildInternalLinkPlan, buildLinkGraph } from "./v2/internal-links.js";
import { buildAnswerBlocks, answersFromFaq, answersFromArticle } from "./v2/answers.js";
import { buildSiteLinkCandidates } from "./v2/site-graph.js";
import { buildArticleLinkCandidates, buildContentClusterReport, buildArticleProfiles, findContentGaps, buildArticleClusterLinks } from "./v2/content-clusters.js";
import { buildContentStrategy, buildUnifiedContentOpportunities } from "./v2/content-strategy.js";
import { enrichOpportunitiesWithSearchConsole } from "./v2/gsc-intelligence.js";
import { buildGscSignalIndex, buildQueryOwnershipMap, detectSearchCannibalization, resolveOpportunitySearchSignals } from "./v2/gsc-signal-resolver.js";
import { detectTemporalCannibalization } from "./v2/gsc-temporal.js";
import { scoreOpportunity, scoreOpportunities, classifyOpportunityAction, decisionConfidenceScore, decisionConfidenceEvidence } from "./v2/opportunity-scoring.js";
import { auditPage } from "./v2/audit.js";
import { buildSEOIntelligence } from "./v2/orchestrator.js";
import { buildKnowledgeGraph, validateKnowledgeGraph, findRelatedEntities, findRelationPaths } from "./v2/knowledge-graph.js";
import { buildMarketOpportunityReport, buildMarketSignalMap } from "./v2/market-opportunities.js";
import { runDiagnostics } from "./v2/diagnostics.js";

/**
 * @param {{
 *  path?: string;
 *  title?: string;
 *  description?: string;
 *  image?: string;
 *  imageWidth?: number;
 *  imageHeight?: number;
 *  imageType?: string;
 *  canonical?: string;
 *  noindex?: boolean;
 *  keywords?: string[];
 *  topics?: string[];
 *  entityType?: string;
 *  lastModified?: string|Date;
 *  answerBlocks?: {question:string;answer:string;sourceUrl?:string;entityId?:string;priority?:number}[];
 *  linkCandidates?: object[];
 *  auditContext?: object;
 *  extraSchema?: object[];
 *  articlePosts?: object[];
 * }} options
 */
export function buildSEO({ path, title, description, image, imageWidth, imageHeight, imageType, canonical, noindex = false, keywords = [], topics = [], entityType = "", lastModified, answerBlocks = [], linkCandidates, auditContext = {}, extraSchema = [], articlePosts = [] } = {}) {
    const site = resolveSite();
    const effectiveNoindex = Boolean(noindex || isPrivateRoute(path));
    const metadata = buildMetadata({ site, title, description, keywords, noindex: effectiveNoindex });
    const canonicalUrl = buildCanonical({ site, path, override: canonical });
    const resolvedImage = absoluteUrl(image || site.image, site.url);
    const topicsResolved = resolveTopics({ title: metadata.title, keywords: metadata.keywords, path, explicit: topics });
    const intent = classifyIntent({ path, title: metadata.title, keywords: metadata.keywords, entityType });
    const freshness = getFreshness(lastModified);
    const knowledgeGraph = buildKnowledgeGraph({
        siteUrl: site.url,
        courses,
        instructors,
        posts: articlePosts
    });
    const knowledgeGraphValidation = validateKnowledgeGraph(knowledgeGraph);
    const candidates = linkCandidates?.length
        ? linkCandidates
        : [
            ...buildSiteLinkCandidates(site, { courses, instructors }),
            ...buildArticleLinkCandidates(articlePosts, site.url)
        ];
    const links = buildInternalLinkPlan({
        currentUrl: canonicalUrl,
        currentTopics: topicSlugs({ title: metadata.title, keywords: metadata.keywords, path, explicit: topics }),
        currentType: entityType,
        candidates,
        semanticGraph: knowledgeGraph
    });
    const answers = buildAnswerBlocks(answerBlocks);
    const clusterReport = articlePosts.length ? buildContentClusterReport(articlePosts, { courses, siteUrl: site.url }) : null;
    const contentStrategy = clusterReport ? clusterReport.strategy : buildContentStrategy([], courses, { siteUrl: site.url });
    const openGraph = buildOpenGraph({
        site,
        metadata,
        image: resolvedImage,
        url: canonicalUrl,
        type: entityType === "Article" ? "article" : undefined,
        imageWidth,
        imageHeight,
        imageType
    });
    const twitter = buildTwitter({ metadata, image: resolvedImage, site });
    const webPageSchema = buildWebPageSchema({ url: canonicalUrl, title: metadata.title, description: metadata.description, image: resolvedImage, keywords: metadata.keywords, topics: topicsResolved, extraSchema, site, lastModified });
    const schemaGraph = buildSchemaGraph([
        buildOrganizationSchema(site),
        buildWebsiteSchema(site),
        webPageSchema,
        buildLocalPlaceSchema(site),
        ...buildTopicSchemas(topicsResolved, { site }),
        ...extraSchema
    ], { knowledgeGraph });
    const audit = auditPage({
        metadata,
        url: canonicalUrl,
        canonical: canonicalUrl,
        schemaGraph,
        indexable: !effectiveNoindex,
        topicSlugs: topicsResolved.map((topic) => topic.slug),
        primaryIntent: intent.primary,
        freshness,
        answerBlockCount: answers.length,
        answerBlockSourceCount: answers.filter((block) => block?.sourceUrl).length,
        knowledgeGraphStats: knowledgeGraph.statistics,
        ...auditContext
    });
    const diagnostics = runDiagnostics({
        audits: [audit],
        graphValidation: knowledgeGraphValidation,
        knowledgeGraph
    });
    return Object.freeze({
        metadata,
        canonical: canonicalUrl,
        openGraph,
        twitter,
        schemaGraph,
        geo: Object.freeze({
            topics: topicsResolved,
            intent,
            freshness,
            internalLinks: links,
            answerBlocks: answers,
            audit,
            clusters: clusterReport,
            strategy: contentStrategy,
            knowledgeGraph,
            diagnostics
        })
    });
}

export { resolveSite, resolveCourse, resolveInstructor, buildCourseSchema, buildCourseStyleSchemas, buildGuitarStyleSchema, buildPersonSchema,
    buildProfilePageSchema, buildArticleSchema, buildVideoSchema, buildBreadcrumbSchema, buildFaqSchema, buildItemListSchema, buildImageGallerySchema, buildAboutPageSchema, buildContactPageSchema, buildLocalPlaceSchema, buildWebPageSchema, resolveTopics, topicSlugs, classifyIntent, getFreshness, buildInternalLinkPlan, buildLinkGraph, buildAnswerBlocks, answersFromFaq, answersFromArticle, buildSiteLinkCandidates, buildArticleLinkCandidates, buildContentClusterReport, buildArticleProfiles, buildArticleClusterLinks, findContentGaps, buildContentStrategy, buildUnifiedContentOpportunities, enrichOpportunitiesWithSearchConsole, buildGscSignalIndex, buildQueryOwnershipMap, detectSearchCannibalization, resolveOpportunitySearchSignals, detectTemporalCannibalization, scoreOpportunity, scoreOpportunities, classifyOpportunityAction, decisionConfidenceScore, decisionConfidenceEvidence, buildSEOIntelligence, buildKnowledgeGraph, validateKnowledgeGraph, findRelatedEntities, findRelationPaths, buildMarketOpportunityReport, buildMarketSignalMap, runDiagnostics, normalizeQuery, queryTokens, isBrandNavigationQuery, isOwnershipEligibleQuery, auditPage, isPrivateRoute };
