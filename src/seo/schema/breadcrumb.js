/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Breadcrumb Schema
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";
import { absoluteUrl } from "../helpers/url.js";

/**
 * @param {{name: string, path: string}[]} items
 * @param {import("../resolvers/site.js").ResolvedSite} site
 * @returns {Object|null}
 */
export function buildBreadcrumbSchema(items, site) {
    if (!items || items.length === 0) {
        return null;
    }

    return {
        "@type": SCHEMA_TYPES.BREADCRUMB_LIST,
        itemListElement: items.map((item, index) => ({
            "@type": SCHEMA_TYPES.LIST_ITEM,
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path, site.url)
        }))
    };
}
