/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Graph Builder
 * Description: Every page renders exactly one JSON-LD script
 * tag containing this @graph. Entity nodes with the same @id
 * are merged so SEO and GEO layers cannot duplicate core entities.
 * --------------------------------------------------------
 */

import { mergeEntityNodes } from "../geo/graph.js";

/**
 * @param {Object[]} nodes
 * @returns {Object}
 */
export function buildSchemaGraph(nodes) {
    return {
        "@context": "https://schema.org",
        "@graph": mergeEntityNodes((nodes || []).filter(Boolean))
    };
}
