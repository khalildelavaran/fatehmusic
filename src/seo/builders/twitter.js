/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Twitter Builder
 * --------------------------------------------------------
 */

import { TWITTER_CARD_TYPE } from "../config/constants.js";

/**
 * @param {Object} params
 * @param {Object} params.metadata
 * @param {string} params.image
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {Object}
 */
export function buildTwitter({ metadata, image, site }) {
    const result = {
        "twitter:card": TWITTER_CARD_TYPE,
        "twitter:title": metadata.title,
        "twitter:description": metadata.description,
        "twitter:image": image,
        "twitter:image:alt": metadata.title
    };

    if (site?.twitterHandle) {
        result["twitter:site"] = site.twitterHandle;
        result["twitter:creator"] = site.twitterHandle;
    }

    return Object.freeze(result);
}
