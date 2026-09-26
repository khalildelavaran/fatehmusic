/**
 * Fateh Music Academy — ProfilePage schema
 */

import { SCHEMA_TYPES } from "../config/constants.js";

export function buildProfilePageSchema(instructor, { site, dateModified } = {}) {
    const profileUrl = String(instructor.url).replace(/\/$/, "");
    const node = {
        "@type": SCHEMA_TYPES.PROFILE_PAGE,
        "@id": profileUrl + "/#profilepage",
        url: profileUrl,
        name: instructor.name + " | آموزشگاه موسیقی فاتح",
        mainEntity: { "@id": profileUrl + "/#person" },
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
