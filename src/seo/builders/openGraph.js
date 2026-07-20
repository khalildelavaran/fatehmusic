/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: OpenGraph Builder
 * --------------------------------------------------------
 */

import { DEFAULT_OG_TYPE, DEFAULT_LOCALE } from "../config/constants.js";

/**
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @param {Object} params.metadata
 * @param {string} params.image
 * @param {string} params.url
 * @param {string} [params.type]
 * @returns {Object}
 */
export function buildOpenGraph({ site, metadata, image, url, type = DEFAULT_OG_TYPE }) {
    return Object.freeze({
        "og:type": type,
        "og:locale": DEFAULT_LOCALE,
        "og:site_name": site.name,
        "og:title": metadata.title,
        "og:description": metadata.description,
        "og:url": url,
        "og:image": image
    });
}
