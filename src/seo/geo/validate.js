/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: GEO Graph Validator
 * --------------------------------------------------------
 * Lightweight structural validation for the final JSON-LD graph.
 * This intentionally validates graph integrity, not Google's rich-result
 * eligibility rules.
 * --------------------------------------------------------
 */

const ABSOLUTE_ID = /^https?:\/\/[^\s#]+(?:\/|#[^\s]+|[^\s]*)$/;

export function validateEntityGraph(graph) {
    const nodes = Array.isArray(graph?.["@graph"]) ? graph["@graph"] : [];
    const errors = [];
    const ids = new Map();

    for (const node of nodes) {
        if (!node || typeof node !== "object") {
            errors.push("Graph contains a non-object node");
            continue;
        }

        const id = node["@id"];
        if (!id) {
            errors.push("Graph node is missing @id");
            continue;
        }

        if (!ABSOLUTE_ID.test(id)) {
            errors.push(`Invalid @id: ${id}`);
        }

        ids.set(id, (ids.get(id) || 0) + 1);
    }

    for (const [id, count] of ids) {
        if (count > 1) errors.push(`Duplicate @id: ${id}`);
    }

    const hasId = (id) => ids.has(id);
    const websiteId = findId(nodes, "#website");
    const organizationId = findId(nodes, "#organization");

    if (!organizationId) errors.push("Missing canonical Organization entity");
    if (!websiteId) errors.push("Missing canonical WebSite entity");

    if (websiteId) {
        const website = nodes.find((node) => node?.["@id"] === websiteId);
        const publisherId = website?.publisher?.["@id"];
        if (!publisherId || !hasId(publisherId)) {
            errors.push("WebSite publisher reference is missing or orphaned");
        } else if (organizationId && publisherId !== organizationId) {
            errors.push("WebSite publisher does not reference canonical Organization");
        }
    }

    for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const type = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];

        if (type.includes("CourseInstance")) {
            const courseId = node.about?.["@id"];
            if (courseId && !hasId(courseId)) {
                errors.push(`CourseInstance about reference is orphaned: ${courseId}`);
            }
            for (const instructor of asArray(node.instructor)) {
                if (instructor?.["@id"] && !hasId(instructor["@id"])) {
                    errors.push(`CourseInstance instructor reference is orphaned: ${instructor["@id"]}`);
                }
            }
        }

        if (type.includes("Article")) {
            for (const author of asArray(node.author)) {
                if (author?.["@id"] && !hasId(author["@id"])) {
                    errors.push(`Article author reference is orphaned: ${author["@id"]}`);
                }
            }
            const courseId = node.about?.["@id"];
            if (courseId && !hasId(courseId)) {
                errors.push(`Article about reference is orphaned: ${courseId}`);
            }
        }
    }

    return Object.freeze({
        valid: errors.length === 0,
        errors,
        nodeCount: nodes.length,
        entityCount: ids.size
    });
}

function findId(nodes, fragment) {
    return nodes.find((node) => typeof node?.["@id"] === "string" && node["@id"].endsWith(fragment))?.["@id"];
}

function asArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}
