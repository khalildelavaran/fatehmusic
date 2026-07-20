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
 * @returns {Object}
 */
export function buildTwitter({ metadata, image }) {
    return Object.freeze({
        "twitter:card": TWITTER_CARD_TYPE,
        "twitter:title": metadata.title,
        "twitter:description": metadata.description,
        "twitter:image": image
    });
}
