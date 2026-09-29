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
import { validateSchemaTypes, validateSchemaContracts } from "./registry.js";

/**
 * @param {Object[]} nodes
 * @returns {Object}
 */
export function buildSchemaGraph(nodes = [], { knowledgeGraph = null } = {}) {
    const merged = mergeEntityNodes(nodes.filter(Boolean));
    const compiled = compileKnowledgeGraphEdges(merged, knowledgeGraph);
    const typeValidation = validateSchemaTypes(compiled);
    if (!typeValidation.valid) {
        throw new Error("SCHEMA_REGISTRY_VALIDATION_FAILED: " + typeValidation.errors.join(" | "));
    }
    const contractValidation = validateSchemaContracts(compiled);
    if (!contractValidation.valid) {
        throw new Error("SCHEMA_CONTRACT_VALIDATION_FAILED: " + contractValidation.errors.join(" | "));
    }

    return deepFreeze({
        "@context": "https://schema.org",
        "@graph": compiled
    });
}


function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);

    for (const child of Object.values(value)) {
        deepFreeze(child, seen);
    }

    return Object.freeze(value);
}
