/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Topic Entity Schema
 * --------------------------------------------------------
 */

/**
 * Build stable lightweight Thing nodes for resolved topics.
 * These nodes are semantic graph anchors, not keyword stuffing.
 * Keep properties on Thing limited to properties valid for the generic type.
 * @param {{slug:string,name:string}[]} topics
 * @param {import("../resolvers/site.js").ResolvedSite} site
 */
export function buildTopicSchemas(topics = [], { site }) {
    return topics.map((topic) => ({
        "@type": "Thing",
        "@id": `${site.url}/#topic-${topic.slug}`,
        name: topic.name
    }));
}
