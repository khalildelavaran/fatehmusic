/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Graph Builder
 * Description: Every page renders exactly one JSON-LD script
 * tag containing this @graph, instead of several separate
 * <script> tags with duplicated Organization data.
 * --------------------------------------------------------
 */

/**
 * @param {Object[]} nodes
 * @returns {Object}
 */
export function buildSchemaGraph(nodes) {
    return {
        "@context": "https://schema.org",
        "@graph": (nodes || []).filter(Boolean)
    };
}
