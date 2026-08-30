/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: WebPage Schema
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";
import { absoluteUrl } from "../helpers/url.js";

/**
 * @param {Object} params
 * @param {string} params.url
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} [params.image]
 * @param {string[]} [params.keywords]
 * @param {{slug:string,name:string}[]} [params.topics]
 * @param {Object[]} [params.extraSchema]
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 */
export function buildWebPageSchema({
    url,
    title,
    description,
    image,
    keywords = [],
    topics = [],
    extraSchema = [],
    site
}) {
    const mainEntity = resolveMainEntity(extraSchema);
    const topicRefs = topics.map((topic) => ({
        "@id": `${site.url}/topics/${topic.slug}/#topic`
    }));

    return pruneEmpty({
        "@type": SCHEMA_TYPES.WEB_PAGE,
        "@id": `${url}/#webpage`,
        url,
        name: title,
        description,
        keywords,
        inLanguage: "fa-IR",
        isPartOf: { "@id": `${site.url}/#website` },
        about: { "@id": `${site.url}/#organization` },
        publisher: { "@id": `${site.url}/#organization` },
        mentions: topicRefs.length ? topicRefs : undefined,
        mainEntity: mainEntity ? { "@id": mainEntity } : { "@id": `${site.url}/#organization` },
        primaryImageOfPage: image
            ? {
                  "@type": "ImageObject",
                  url: absoluteUrl(image, site.url),
                  caption: title
              }
            : undefined
    });
}

function resolveMainEntity(extraSchema) {
    const preferredTypes = new Set([
        SCHEMA_TYPES.ARTICLE,
        SCHEMA_TYPES.COURSE,
        SCHEMA_TYPES.PERSON,
        SCHEMA_TYPES.ABOUT_PAGE,
        SCHEMA_TYPES.CONTACT_PAGE,
        "ItemList"
    ]);

    const node = extraSchema.find(
        (item) => item && preferredTypes.has(item["@type"]) && item["@id"]
    );

    return node?.["@id"];
}

function pruneEmpty(node) {
    return Object.fromEntries(
        Object.entries(node).filter(([, value]) => value !== undefined)
    );
}
