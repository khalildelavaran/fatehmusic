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
import { buildTopicSchemas } from "./schema/topic.js";
import { buildLocalPlaceSchema } from "./schema/local-place.js";
import { buildCourseSchema } from "./schema/course.js";
import { buildPersonSchema } from "./schema/person.js";
import { buildArticleSchema } from "./schema/article.js";
import { buildFaqSchema } from "./schema/faq.js";
import { buildBreadcrumbSchema } from "./schema/breadcrumb.js";
import { buildItemListSchema } from "./schema/itemlist.js";
import { buildAboutPageSchema } from "./schema/aboutpage.js";
import { buildContactPageSchema } from "./schema/contactpage.js";
import { absoluteUrl } from "./helpers/url.js";
import { isPrivateRoute } from "./helpers/private-route.js";
import { resolveTopics, topicSlugs } from "./v2/topics.js";
import { classifyIntent } from "./v2/intents.js";
import { getFreshness } from "./v2/freshness.js";
import { buildInternalLinkPlan, buildLinkGraph } from "./v2/internal-links.js";
import { buildAnswerBlocks, answersFromFaq } from "./v2/answers.js";
import { buildSiteLinkCandidates } from "./v2/site-graph.js";
import { buildArticleLinkCandidates, buildContentClusterReport, buildArticleProfiles, findContentGaps } from "./v2/content-clusters.js";
import { auditPage } from "./v2/audit.js";

export function buildSEO({ path, title, description, image, canonical, noindex = false, keywords = [], topics = [], entityType = "", lastModified, answerBlocks = [], linkCandidates, auditContext = {}, extraSchema = [], articlePosts = [] } = {}) {
    const site = resolveSite();
    const effectiveNoindex = Boolean(noindex || isPrivateRoute(path));
    const metadata = buildMetadata({ site, title, description, keywords, noindex: effectiveNoindex });
    const canonicalUrl = buildCanonical({ site, path, override: canonical });
    const resolvedImage = absoluteUrl(image || site.image, site.url);
    const topicsResolved = resolveTopics({ title: metadata.title, keywords: metadata.keywords, path, explicit: topics });
    const intent = classifyIntent({ path, title: metadata.title, keywords: metadata.keywords, entityType });
    const freshness = getFreshness(lastModified);
    const candidates = linkCandidates ?? [...buildSiteLinkCandidates(site), ...buildArticleLinkCandidates(articlePosts, site.url)];
    const links = buildInternalLinkPlan({ currentUrl: canonicalUrl, currentTopics: topicSlugs({ title: metadata.title, keywords: metadata.keywords, path, explicit: topics }), currentType: entityType, candidates });
    const answers = buildAnswerBlocks(answerBlocks);
    const clusters = articlePosts.length ? buildContentClusterReport(articlePosts) : null;
    const openGraph = buildOpenGraph({ site, metadata, image: resolvedImage, url: canonicalUrl });
    const twitter = buildTwitter({ metadata, image: resolvedImage });
    const webPageSchema = buildWebPageSchema({ url: canonicalUrl, title: metadata.title, description: metadata.description, image: resolvedImage, keywords: metadata.keywords, topics: topicsResolved, extraSchema, site });
    const schemaGraph = buildSchemaGraph([buildOrganizationSchema(site), buildWebsiteSchema(site), webPageSchema, ...buildTopicSchemas(topicsResolved, { site }), ...extraSchema]);
    const audit = auditPage({ metadata, url: canonicalUrl, schemaGraph, indexable: !effectiveNoindex, topicSlugs: topicsResolved.map((topic) => topic.slug), primaryIntent: intent.primary, freshness, ...auditContext });
    return Object.freeze({ metadata, canonical: canonicalUrl, openGraph, twitter, schemaGraph, geo: Object.freeze({ topics: topicsResolved, intent, freshness, internalLinks: links, answerBlocks: answers, audit, clusters }) });
}

export { resolveSite, resolveCourse, resolveInstructor, buildCourseSchema, buildPersonSchema, buildArticleSchema, buildFaqSchema, buildBreadcrumbSchema, buildItemListSchema, buildAboutPageSchema, buildContactPageSchema, buildLocalPlaceSchema, buildWebPageSchema, resolveTopics, topicSlugs, classifyIntent, getFreshness, buildInternalLinkPlan, buildLinkGraph, buildAnswerBlocks, answersFromFaq, buildSiteLinkCandidates, buildArticleLinkCandidates, buildContentClusterReport, buildArticleProfiles, findContentGaps, auditPage, isPrivateRoute };
