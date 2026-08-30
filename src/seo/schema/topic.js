/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Topic Entity Schema
 * --------------------------------------------------------
 */

/**
 * Build stable lightweight Thing nodes for resolved topics.
 * These nodes are semantic graph anchors, not keyword stuffing.
 * @param {{slug:string,name:string}[]} topics
 * @param {import("../resolvers/site.js").ResolvedSite} site
 */
export function buildTopicSchemas(topics = [], { site }) {
    return topics.map((topic) => ({
        "@type": "Thing",
        "@id": `${site.url}/topics/${topic.slug}/#topic`,
        name: topic.name,
        url: `${site.url}/topics/${topic.slug}`,
        inLanguage: "fa-IR"
    }));
}
