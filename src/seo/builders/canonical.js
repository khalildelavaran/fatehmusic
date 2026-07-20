/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Canonical Builder
 * --------------------------------------------------------
 */

import { absoluteUrl, normalizePath } from "../helpers/url.js";

/**
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @param {string} [params.path]
 * @param {string} [params.override]
 * @returns {string}
 */
export function buildCanonical({ site, path, override }) {
    const target = override || path || "/";

    return absoluteUrl(normalizePath(target), site.url);
}
