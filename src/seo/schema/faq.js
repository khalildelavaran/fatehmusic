/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: FAQ Schema
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";

/**
 * @param {{question: string, answer: string}[]} faqItems
 * @returns {Object|null}
 */
export function buildFaqSchema(faqItems) {
    if (!faqItems || faqItems.length === 0) {
        return null;
    }

    return {
        "@type": SCHEMA_TYPES.FAQ_PAGE,
        mainEntity: faqItems.map((item) => ({
            "@type": SCHEMA_TYPES.QUESTION,
            name: item.question,
            acceptedAnswer: {
                "@type": SCHEMA_TYPES.ANSWER,
                text: item.answer
            }
        }))
    };
}
