/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: GEO Entity Graph
 * --------------------------------------------------------
 * Canonical relationship helpers shared by GEO and JSON-LD.
 * Core Organization/WebSite entities are owned by their Schema builders.
 * --------------------------------------------------------
 */

import { courseEntityId, instructorEntityId } from "./entity.js";

/**
 * Build canonical Course → Instructor references from the resolved Course.
 * The resolver remains the single source of truth for this relationship.
 *
 * @param {Object} course
 * @returns {Array<{"@id": string}>}
 */
export function buildCourseInstructorRefs(course) {
    return (course?.instructors || [])
        .filter((instructor) => instructor?.url)
        .map((instructor) => ({ "@id": instructorEntityId(instructor.url) }));
}

/**
 * Canonical Course reference used by CourseInstance relationships.
 *
 * @param {Object} course
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
 * properties. Later nodes only fill missing properties.
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
