/**
 * Fateh Music Academy — SEO/GEO Engine v2 public entry point.
 */
import { resolveSite } from "./resolvers/site.js";
import { buildMetadata } from "./builders/metadata.js";
import { buildCanonical } from "./builders/canonical.js";
import { buildOpenGraph } from "./builders/openGraph.js";
import { buildTwitter } from "./builders/twitter.js";
import { buildOrganizationSchema } from "./schema/organization.js";
import { buildWebsiteSchema } from "./schema/website.js";
import { buildWebPageSchema } from "./schema/webpage.js";
import { buildSchemaGraph } from "./schema/graph.js";
import { buildTopicSchemas } from "./schema/topic.js";
import { buildLocalPlaceSchema } from "./schema/local-place.js";
import { absoluteUrl } from "./helpers/url.js";
import { isPrivateRoute } from "./helpers/private-route.js";
import { resolveTopics, topicSlugs } from "./v2/topics.js";
import { classifyIntent } from "./v2/intents.js";
import { getFreshness } from "./v2/freshness.js";
import { buildInternalLinkPlan } from "./v2/internal-links.js";
import { auditPage } from "./v2/audit.js";
import { buildAnswerBlocks } from "./v2/answers.js";
import { buildSiteLinkCandidates } from "./v2/site-graph.js";

export function buildSEO({ path, title, description, image, canonical, noindex = false, keywords = [], topics = [], entityType = "", lastModified, answerBlocks = [], linkCandidates = [], auditContext = {}, extraSchema = [] } = {}) {
    const site = resolveSite();
    const effectiveNoindex = Boolean(noindex || isPrivateRoute(path));
    const metadata = buildMetadata({ site, title, description, keywords, noindex: effectiveNoindex });
    const canonicalUrl = buildCanonical({ site, path, override: canonical });
    const resolvedImage = absoluteUrl(image || site.image, site.url);
    const topicsResolved = resolveTopics({ title: metadata.title, keywords: metadata.keywords, path, explicit: topics });
    const intent = classifyIntent({ path, title: metadata.title, keywords: metadata.keywords, entityType });
    const freshness = getFreshness(lastModified);
    const links = buildInternalLinkPlan({
        currentUrl: canonicalUrl,
        currentTopics: topicSlugs({ title: metadata.title, keywords: metadata.keywords, path, explicit: topics }),
        currentType: entityType,
        candidates: linkCandidates
    });
    const answers = buildAnswerBlocks(answerBlocks);
    const openGraph = buildOpenGraph({ site, metadata, image: resolvedImage, url: canonicalUrl });
    const twitter = buildTwitter({ metadata, image: resolvedImage });
    const webPageSchema = buildWebPageSchema({ url: canonicalUrl, title: metadata.title, description: metadata.description, image: resolvedImage, keywords: metadata.keywords, topics: topicsResolved, extraSchema, site });
    const schemaGraph = buildSchemaGraph([
        buildOrganizationSchema(site),
        buildWebsiteSchema(site),
        webPageSchema,
        ...buildTopicSchemas(topicsResolved, { site }),
        ...extraSchema
    ]);
    const audit = auditPage({ metadata, url: canonicalUrl, schemaGraph, indexable: !effectiveNoindex, topicSlugs: topicsResolved.map((topic) => topic.slug), primaryIntent: intent.primary, freshness, ...auditContext });
    return Object.freeze({ metadata, canonical: canonicalUrl, openGraph, twitter, schemaGraph, geo: Object.freeze({ topics: topicsResolved, intent, freshness, internalLinks: links, answerBlocks: answers, audit }) });
}

export { resolveSite, resolveCourse, resolveInstructor, buildCourseSchema, buildPersonSchema, buildArticleSchema, buildFaqSchema, buildBreadcrumbSchema, buildItemListSchema, buildAboutPageSchema, buildContactPageSchema, buildWebPageSchema, buildTopicSchemas, buildLocalPlaceSchema } from "./exports.js";
export { resolveTopics, topicSlugs } from "./v2/topics.js";
export { classifyIntent } from "./v2/intents.js";
export { getFreshness, toIsoDate, daysSince } from "./v2/freshness.js";
export { buildInternalLinkPlan, buildLinkGraph } from "./v2/internal-links.js";
export { buildAnswerBlocks, answersFromFaq } from "./v2/answers.js";
export { buildSiteLinkCandidates } from "./v2/site-graph.js";
export { auditPage } from "./v2/audit.js";
export { isPrivateRoute } from "./helpers/private-route.js";
