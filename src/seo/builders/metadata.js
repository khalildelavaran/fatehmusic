/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Metadata Builder
 * --------------------------------------------------------
 */

import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_KEYWORDS } from "../config/constants.js";
import { DEFAULT_ROBOTS, NOINDEX_ROBOTS, DEFAULT_THEME_COLOR } from "../config/defaults.js";
import { truncate, clean, dedupe } from "../helpers/text.js";

/**
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @param {string} [params.title]
 * @param {string} [params.description]
 * @param {string[]} [params.keywords]
 * @param {boolean} [params.noindex]
 * @returns {Object}
 */
export function buildMetadata({ site, title, description, keywords = [], noindex = false }) {
    const resolvedTitle = clean(title) || site.name;
    const resolvedDescription = clean(description) || site.description;

    return Object.freeze({
        title: truncate(resolvedTitle, MAX_TITLE_LENGTH),
        description: truncate(resolvedDescription, MAX_DESCRIPTION_LENGTH),
        keywords: dedupe([...(keywords || []), ...site.keywords]).slice(
            0,
            MAX_KEYWORDS
        ),
        robots: noindex ? NOINDEX_ROBOTS : DEFAULT_ROBOTS,
        author: site.name,
        themeColor: DEFAULT_THEME_COLOR
    });
}
