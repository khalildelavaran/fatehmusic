/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: GEO Entity Graph
 * --------------------------------------------------------
 * Builds the stable core relationships shared by GEO and JSON-LD.
 */

import { buildCoreEntityIds, entityRef } from "./entity.js";

/**
 * @param {import("../resolvers/site.js").ResolvedSite} site
 * @returns {Object[]}
 */
export function buildCoreEntityGraph(site) {
    const ids = buildCoreEntityIds(site);

    return [
        {
            "@id": ids.organization,
            "@type": "MusicSchool",
            url: site.url,
            name: site.name
        },
        {
            "@id": ids.website,
            "@type": "WebSite",
            url: site.url,
            name: site.name,
            publisher: entityRef(site.url, "organization")
        }
    ];
}

/**
 * Adds stable entity references to an existing node without replacing its
 * existing Schema.org properties.
 *
 * @param {Object} node
 * @param {Object} refs
 * @returns {Object}
 */
export function withEntityReferences(node, refs = {}) {
    const result = { ...node };

    for (const [key, value] of Object.entries(refs)) {
        if (value == null) continue;
        result[key] = typeof value === "string" ? { "@id": value } : value;
    }

    return result;
}
