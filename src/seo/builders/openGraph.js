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
 * @param {number} [params.imageWidth]
 * @param {number} [params.imageHeight]
 * @param {string} [params.imageType]
 * @returns {Object}
 */
export function buildOpenGraph({
    site,
    metadata,
    image,
    url,
    type = DEFAULT_OG_TYPE,
    imageWidth,
    imageHeight,
    imageType
}) {
    const graph = {
        "og:type": type,
        "og:locale": DEFAULT_LOCALE,
        "og:site_name": site.name,
        "og:title": metadata.title,
        "og:description": metadata.description,
        "og:url": url,
        "og:image": image,
        "og:image:alt": metadata.title
    };

    if (Number.isFinite(imageWidth) && imageWidth > 0) graph["og:image:width"] = String(imageWidth);
    if (Number.isFinite(imageHeight) && imageHeight > 0) graph["og:image:height"] = String(imageHeight);
    const resolvedImageType = imageType || inferImageType(image);
    if (resolvedImageType) graph["og:image:type"] = resolvedImageType;

    return Object.freeze(graph);
}

function inferImageType(image) {
    const extension = String(image || "").split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
    const map = {
        avif: "image/avif",
        webp: "image/webp",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg"
    };
    return map[extension] || undefined;
}
