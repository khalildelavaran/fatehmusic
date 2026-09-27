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
    const fallbackPath = normalizePath(path || "/");
    const target = override || fallbackPath;

    try {
        const siteUrl = new URL(site.url);
        const requested = new URL(target, site.url);

        // Canonicals describe the current site's canonical URL. Never let a
        // malformed or cross-origin override turn a page into an external
        // canonical by accident.
        if (requested.origin !== siteUrl.origin) {
            return absoluteUrl(fallbackPath, site.url);
        }

        requested.search = "";
        requested.hash = "";
        return requested.toString().replace(/\/$/, requested.pathname === "/" ? "/" : "");
    } catch {
        return absoluteUrl(fallbackPath, site.url);
    }
}
