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
 * Build page metadata without manufacturing keyword-stuffed copy.
 *
 * Google may rewrite titles and snippets, so length limits here are
 * guardrails for clean output rather than ranking rules.
 */
export function buildMetadata({ site, title, description, keywords = [], noindex = false }) {
    const resolvedTitle = clean(title) || site.name;
    const resolvedDescription = buildDescription({
        description,
        title: resolvedTitle,
        site
    });

    return Object.freeze({
        title: truncate(resolvedTitle, MAX_TITLE_LENGTH),
        description: truncate(resolvedDescription, MAX_DESCRIPTION_LENGTH),
        // Keywords remain internal engine signals for topic/entity resolution.
        // They are intentionally not rendered as a meta[name="keywords"] tag.
        keywords: dedupe([...(keywords || []), ...site.keywords]).slice(0, MAX_KEYWORDS),
        robots: noindex ? NOINDEX_ROBOTS : DEFAULT_ROBOTS,
        author: site.name,
        themeColor: DEFAULT_THEME_COLOR
    });
}

/**
 * Prefer editorially supplied descriptions exactly as written.
 * Only generate a fallback when no usable description was supplied.
 */
function buildDescription({ description, title, site }) {
    const base = clean(description);

    if (base) {
        return base;
    }

    return clean(title + "؛ " + site.description);
}
