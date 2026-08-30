/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: GEO Entity References
 * --------------------------------------------------------
 * Centralizes canonical @id generation so Organization, Course,
 * Instructor, Article and Branch relationships remain stable across
 * JSON-LD and future GEO features.
 */

/**
 * @param {string} baseUrl
 * @param {string} fragment
 * @returns {string}
 */
export function entityId(baseUrl, fragment) {
    return `${String(baseUrl).replace(/\/$/, "")}/#${fragment}`;
}

/**
 * @param {string} url
 * @param {string} fragment
 * @returns {{"@id": string}}
 */
export function entityRef(url, fragment) {
    return { "@id": entityId(url, fragment) };
}

/**
 * Canonical IDs for the academy's core entity graph.
 * @param {import("../resolvers/site.js").ResolvedSite} site
 */
export function buildCoreEntityIds(site) {
    const base = String(site.url).replace(/\/$/, "");

    return Object.freeze({
        organization: `${base}/#organization`,
        website: `${base}/#website`
    });
}

/**
 * @param {string} url
 * @returns {string}
 */
export function courseEntityId(url) {
    return `${String(url).replace(/\/$/, "")}/#course`;
}

/**
 * @param {string} url
 * @returns {string}
 */
export function instructorEntityId(url) {
    return `${String(url).replace(/\/$/, "")}/#person`;
}

/**
 * @param {string} url
 * @returns {string}
 */
export function articleEntityId(url) {
    return `${String(url).replace(/\/$/, "")}/#article`;
}
