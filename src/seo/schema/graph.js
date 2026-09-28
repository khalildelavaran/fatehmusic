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
import { compileKnowledgeGraphEdges } from "./compiler.js";
import { validateSchemaTypes } from "./registry.js";

/**
 * @param {Object[]} nodes
 * @returns {Object}
 */
export function buildSchemaGraph(nodes = [], { knowledgeGraph = null } = {}) {
    const merged = mergeEntityNodes(nodes.filter(Boolean));
    const compiled = compileKnowledgeGraphEdges(merged, knowledgeGraph);
    const validation = validateSchemaTypes(compiled);
    if (!validation.valid) {
        throw new Error("SCHEMA_REGISTRY_VALIDATION_FAILED: " + validation.errors.join(" | "));
    }

    return Object.freeze({
        "@context": "https://schema.org",
        "@graph": compiled
    });
}
