/**
 * Fateh Music Academy — ContactPage Schema
 * Local contact/entity page for /contact.
 */

import { SCHEMA_TYPES } from "../config/constants.js";
import { absoluteUrl } from "../helpers/url.js";

/**
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {Object}
 */
export function buildContactPageSchema({ title, description, site }) {
    const url = absoluteUrl("/contact", site.url);

    return pruneEmpty({
        "@type": SCHEMA_TYPES.CONTACT_PAGE,
        "@id": `${url}#contactpage`,
        url,
        name: title,
        description,
        inLanguage: "fa-IR",
        isPartOf: { "@id": `${site.url}/#website` },
        about: { "@id": `${site.url}/#organization` },
        mainEntity: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@id": `${url}#webpage` },
        publisher: { "@id": `${site.url}/#organization` },
        primaryImageOfPage: site.image
            ? {
                "@type": "ImageObject",
                url: site.image,
                caption: title
            }
            : undefined
    });
}

function pruneEmpty(node) {
    return Object.fromEntries(
        Object.entries(node).filter(([, value]) => value !== undefined)
    );
}
