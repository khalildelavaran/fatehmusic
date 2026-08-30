/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: GEO Entity Graph
 * --------------------------------------------------------
 * Stable entity relationships shared by GEO and JSON-LD.
 */

import {
    buildCoreEntityIds,
    entityRef,
    courseEntityId,
    instructorEntityId
} from "./entity.js";

export function buildCoreEntityGraph(site) {
    const ids = buildCoreEntityIds(site);

    return [
        {
            "@id": ids.organization,
            "@type": "MusicSchool",
            url: site.url,
            name: site.name
        },
        {
            "@id": ids.website,
            "@type": "WebSite",
            url: site.url,
            name: site.name,
            publisher: entityRef(site.url, "organization")
        }
    ];
}

/**
 * Build the canonical Course ↔ Instructor references from the already
 * resolved Course/Instructor contracts. The resolver remains the single
 * source of truth for the relationship; this layer only converts it into
 * stable entity references.
 *
 * @param {Object} course - resolved course
 * @returns {Array<{"@id": string}>}
 */
export function buildCourseInstructorRefs(course) {
    return (course?.instructors || [])
        .filter((instructor) => instructor?.url)
        .map((instructor) => ({
            "@id": instructorEntityId(instructor.url)
        }));
}

/**
 * Build the canonical Course reference for a CourseInstance. `about` is a
 * schema.org-supported relationship on CourseInstance/Event and makes the
 * CourseInstance node explicitly point back to its Course entity, while the
 * existing `instructor` property points to the Person entity.
 *
 * @param {Object} course - resolved course
 * @returns {{"@id": string}}
 */
export function buildCourseRef(course) {
    return { "@id": courseEntityId(course.url) };
}

export function withEntityReferences(node, refs = {}) {
    const result = { ...node };

    for (const [key, value] of Object.entries(refs)) {
        if (value == null) continue;
        result[key] = typeof value === "string" ? { "@id": value } : value;
    }

    return result;
}

/**
 * Merge nodes sharing the same @id while preserving the first node's
 * properties. Later nodes only fill missing properties. This prevents the
 * GEO layer from creating duplicate Organization/WebSite entities when it is
 * combined with the existing Schema builders.
 */
export function mergeEntityNodes(nodes = []) {
    const byId = new Map();
    const anonymous = [];

    for (const node of nodes) {
        if (!node) continue;
        const id = node["@id"];

        if (!id) {
            anonymous.push(node);
            continue;
        }

        const existing = byId.get(id);
        if (!existing) {
            byId.set(id, { ...node });
            continue;
        }

        for (const [key, value] of Object.entries(node)) {
            if (key === "@id") continue;
            if (existing[key] == null) existing[key] = value;
        }
    }

    return [...byId.values(), ...anonymous];
}
