/**
 * Fateh Music Academy — ProfilePage schema
 */

import { SCHEMA_TYPES } from "../config/constants.js";

export function buildProfilePageSchema(instructor, { site, dateModified } = {}) {
    const node = {
        "@type": SCHEMA_TYPES.PROFILE_PAGE,
        "@id": instructor.url + "/#profilepage",
        url: instructor.url,
        name: instructor.name + " | آموزشگاه موسیقی فاتح",
        mainEntity: { "@id": instructor.url + "/#person" },
        isPartOf: { "@id": site.url + "/#website" },
        dateModified: isValidDate(dateModified) ? dateModified : undefined
    };

    return Object.fromEntries(
        Object.entries(node).filter(([, value]) => value !== undefined && value !== null)
    );
}

function isValidDate(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
