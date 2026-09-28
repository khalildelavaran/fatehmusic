/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Canonical URL Builder
 * --------------------------------------------------------
 */

import { absoluteUrl, normalizePath } from "../helpers/url.js";

/**
 * Canonical URLs are always normalized to the site's own origin.
 * Query strings and fragments never belong in a canonical target.
 *
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @param {string} [params.path]
 * @param {string} [params.override]
 * @returns {string}
 */
export function buildCanonical({ site, path, override } = {}) {
    const fallbackPath = normalizePath(path || "/");
    const target = String(override || fallbackPath).trim();

    if (/^https?:\/\//i.test(target)) {
        try {
            const targetUrl = new URL(target);
            const siteUrl = new URL(site.url);
            const safePath = normalizePath(targetUrl.pathname || "/");
            if (targetUrl.origin === siteUrl.origin) {
                return absoluteUrl(safePath, site.url);
            }
        } catch {
            // Fall through to the site's own canonical fallback.
        }
        return absoluteUrl(fallbackPath, site.url);
    }

    return absoluteUrl(normalizePath(target), site.url);
}
