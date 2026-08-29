/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: AboutPage Schema
 * Description: The primary schema node for /about. Everything
 * it needs (name/description) is passed in by the page itself,
 * exactly like buildBreadcrumbSchema — there is no dedicated
 * data/about.js, since the About page's copy lives in its
 * components, not in a repository file.
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";
import { absoluteUrl } from "../helpers/url.js";

/**
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} [params.image]
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {Object}
 */
export function buildAboutPageSchema({ title, description, image, site }) {
    const url = absoluteUrl("/about", site.url);

    return pruneEmpty({
        "@type": SCHEMA_TYPES.ABOUT_PAGE,
        "@id": `${url}#aboutpage`,
        url,
        name: title,
        description,
        inLanguage: "fa-IR",
        isPartOf: { "@id": `${site.url}/#website` },
        about: { "@id": `${site.url}/#organization` },
        mainEntity: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@id": `${url}#webpage` },
        primaryImageOfPage: image
            ? { "@type": "ImageObject", url: absoluteUrl(image, site.url), caption: title }
            : undefined,
        publisher: { "@id": `${site.url}/#organization` }
    });
}

function pruneEmpty(node) {
    return Object.fromEntries(
        Object.entries(node).filter(([, value]) => value !== undefined)
    );
}
