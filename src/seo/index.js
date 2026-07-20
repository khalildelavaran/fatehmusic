/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Public Entry Point
 * Description: The only file pages and layouts should import
 * from this engine. buildSEO() returns everything a page needs
 * for <head>: metadata, canonical, OpenGraph, Twitter, and one
 * JSON-LD @graph. Entity-specific schema (Course/Person/FAQ/
 * Breadcrumb) is built separately by pages and passed in via
 * `extraSchema` so the graph stays a single source per page.
 * --------------------------------------------------------
 */

import { resolveSite } from "./resolvers/site.js";
import { buildMetadata } from "./builders/metadata.js";
import { buildCanonical } from "./builders/canonical.js";
import { buildOpenGraph } from "./builders/openGraph.js";
import { buildTwitter } from "./builders/twitter.js";
import { buildOrganizationSchema } from "./schema/organization.js";
import { buildWebsiteSchema } from "./schema/website.js";
import { buildSchemaGraph } from "./schema/graph.js";
import { absoluteUrl } from "./helpers/url.js";

/**
 * @param {Object} params
 * @param {string} params.path - Astro.url.pathname
 * @param {string} [params.title]
 * @param {string} [params.description]
 * @param {string} [params.image]
 * @param {string} [params.canonical]
 * @param {boolean} [params.noindex]
 * @param {string[]} [params.keywords]
 * @param {Object[]} [params.extraSchema] - page-specific JSON-LD nodes
 * @returns {Object}
 */
export function buildSEO({
    path,
    title,
    description,
    image,
    canonical,
    noindex = false,
    keywords = [],
    extraSchema = []
} = {}) {
    const site = resolveSite();

    const metadata = buildMetadata({ site, title, description, keywords, noindex });
    const canonicalUrl = buildCanonical({ site, path, override: canonical });
    const resolvedImage = absoluteUrl(image || site.image, site.url);

    const openGraph = buildOpenGraph({
        site,
        metadata,
        image: resolvedImage,
        url: canonicalUrl
    });
    const twitter = buildTwitter({ metadata, image: resolvedImage });

    const schemaGraph = buildSchemaGraph([
        buildOrganizationSchema(site),
        buildWebsiteSchema(site),
        ...extraSchema
    ]);

    return Object.freeze({
        metadata,
        canonical: canonicalUrl,
        openGraph,
        twitter,
        schemaGraph
    });
}

export { resolveSite } from "./resolvers/site.js";
export { resolveCourse } from "./resolvers/course.js";
export { resolveInstructor } from "./resolvers/instructor.js";
export { buildCourseSchema } from "./schema/course.js";
export { buildPersonSchema } from "./schema/person.js";
export { buildFaqSchema } from "./schema/faq.js";
export { buildBreadcrumbSchema } from "./schema/breadcrumb.js";
