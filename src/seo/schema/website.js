/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Website Schema
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES, DEFAULT_LOCALE } from "../config/constants.js";

/**
 * @param {import("../resolvers/site.js").ResolvedSite} site
 * @returns {Object}
 */
export function buildWebsiteSchema(site) {
    return {
        "@type": SCHEMA_TYPES.WEBSITE,
        "@id": `${site.url}/#website`,
        url: site.url,
        name: site.name,
        inLanguage: DEFAULT_LOCALE.replace("_", "-"),
        publisher: {
            "@id": `${site.url}/#organization`
        }
    };
}
