/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Deterministic page audit. This is a quality gate, not a ranking oracle.
 * --------------------------------------------------------
 */

const LIMITS = Object.freeze({
    titleMin: 20,
    titleMax: 65,
    descriptionMin: 80,
    descriptionMax: 170,
    minWords: 250
});

/**
 * @param {Object} input
 * @param {Object} input.metadata
 * @param {string} [input.url]
 * @param {Object} [input.schemaGraph]
 * @param {number} [input.wordCount]
 * @param {number} [input.h1Count]
 * @param {number} [input.missingImageAlt]
 * @param {number} [input.internalLinkCount]
 * @param {boolean} [input.indexable]
 * @param {string[]} [input.topicSlugs]
 * @param {string} [input.primaryIntent]
 * @param {{status:string}} [input.freshness]
 */
export function auditPage({
    metadata = {},
    url = "",
    schemaGraph = {},
    wordCount = 0,
    h1Count = 0,
    missingImageAlt = 0,
    internalLinkCount = 0,
    indexable = true,
    topicSlugs = [],
    primaryIntent = "",
    freshness = { status: "unknown" }
} = {}) {
    const checks = [];
    const pass = (id, label, points) => checks.push({ id, label, status: "pass", points });
    const warn = (id, label, points = 0) => checks.push({ id, label, status: "warn", points });
    const fail = (id, label, points = 0) => checks.push({ id, label, status: "fail", points });

    const titleLength = String(metadata.title || "").length;
    const descriptionLength = String(metadata.description || "").length;
    const graphNodes = Array.isArray(schemaGraph?.["@graph"]) ? schemaGraph["@graph"] : [];

    if (titleLength >= LIMITS.titleMin && titleLength <= LIMITS.titleMax) pass("title", "title length", 10);
    else warn("title", "title length outside recommended range", 5);

    if (descriptionLength >= LIMITS.descriptionMin && descriptionLength <= LIMITS.descriptionMax) pass("description", "description length", 10);
    else warn("description", "description length outside recommended range", 5);

    if (metadata.robots?.includes("index") && indexable) pass("indexability", "indexable", 10);
    else if (!indexable) pass("indexability", "explicitly non-indexable", 10);
    else fail("indexability", "indexability mismatch");

    if (url && metadata.canonical) pass("canonical", "canonical present", 10);
    else fail("canonical", "canonical missing");

    if (graphNodes.length >= 3) pass("schema", "JSON-LD graph populated", 10);
    else warn("schema", "JSON-LD graph is sparse", 5);

    if (h1Count === 1) pass("h1", "exactly one H1", 10);
    else if (h1Count === 0) fail("h1", "H1 missing");
    else warn("h1", "multiple H1 elements", 5);

    if (missingImageAlt === 0) pass("image-alt", "images have alt text", 5);
    else warn("image-alt", `${missingImageAlt} images missing alt text`, 2);

    if (wordCount >= LIMITS.minWords) pass("content-depth", "sufficient visible content", 10);
    else warn("content-depth", "visible content is thin", 4);

    if (internalLinkCount >= 3) pass("internal-links", "strong internal linking", 10);
    else warn("internal-links", "few internal links", 4);

    if (topicSlugs.length >= 1) pass("topics", "topic signals resolved", 5);
    else warn("topics", "no topic signals resolved", 0);

    if (primaryIntent) pass("intent", `primary intent: ${primaryIntent}`, 5);
    else warn("intent", "primary intent unresolved", 0);

    if (freshness?.status === "fresh") pass("freshness", "content freshness is healthy", 5);
    else if (freshness?.status === "aging") warn("freshness", "content is aging", 2);
    else if (freshness?.status === "stale") warn("freshness", "content is stale", 0);
    else warn("freshness", "freshness signal unavailable", 0);

    const score = Math.round(Math.min(100, checks.reduce((sum, item) => sum + item.points, 0)));
    const errors = checks.filter((item) => item.status === "fail");
    const warnings = checks.filter((item) => item.status === "warn");

    return Object.freeze({
        score,
        status: errors.length ? "error" : warnings.length ? "warning" : "pass",
        checks,
        errors,
        warnings,
        summary: {
            url,
            score,
            errors: errors.length,
            warnings: warnings.length,
            graphNodes: graphNodes.length,
            topics: topicSlugs.length,
            primaryIntent
        }
    });
}
