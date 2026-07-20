/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Person Schema
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";

/**
 * @param {Object} instructor - a resolved instructor (from resolveInstructor)
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {Object}
 */
export function buildPersonSchema(instructor, { site }) {
    return pruneEmpty({
        "@type": SCHEMA_TYPES.PERSON,
        "@id": `${instructor.url}/#person`,
        name: instructor.name,
        jobTitle: instructor.position,
        description: instructor.bio,
        image: instructor.image,
        worksFor: { "@id": `${site.url}/#organization` },
        sameAs: instructor.sameAs && instructor.sameAs.length ? instructor.sameAs : undefined
    });
}

function pruneEmpty(node) {
    return Object.fromEntries(
        Object.entries(node).filter(([, value]) => value !== undefined)
    );
}
