/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Metadata Builder
 * --------------------------------------------------------
 */

import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_KEYWORDS } from "../config/constants.js";
import { DEFAULT_ROBOTS, NOINDEX_ROBOTS, DEFAULT_THEME_COLOR } from "../config/defaults.js";
import { truncate, clean, dedupe } from "../helpers/text.js";

const MIN_DESCRIPTION_LENGTH = 120;

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
    const resolvedDescription = buildDescription({
        description,
        title: resolvedTitle,
        site
    });

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

/**
 * Keep short page-specific descriptions useful while avoiding a
 * site-wide duplicate fallback. Existing descriptions that are
 * already sufficiently descriptive are left unchanged.
 *
 * @param {Object} params
 * @param {string} [params.description]
 * @param {string} params.title
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {string}
 */
function buildDescription({ description, title, site }) {
    const base = clean(description);

    if (base.length >= MIN_DESCRIPTION_LENGTH) {
        return base;
    }

    const suffix = ` درباره ${title}؛ اطلاعات دوره، مدرس، شرایط برگزاری و ثبت‌نام در ${site.name} شوشتر را در این صفحه ببینید.`;

    return clean(`${base}${suffix}`);
}
