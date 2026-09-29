/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Deterministic page audit. This is a quality gate, not a ranking oracle.
 * --------------------------------------------------------
 */

const LIMITS = Object.freeze({
    titleMin: 20,
    titleMax: 60,
    descriptionMin: 80,
    descriptionMax: 160
});

/**
 * Only evaluate optional page metrics when the caller explicitly provides
 * them. This prevents false warnings from a head-only buildSEO() call.
 */
export function auditPage({
    metadata = {},
    url = "",
    schemaGraph = {},
    canonical = "",
    indexable = true,
    topicSlugs = [],
    primaryIntent = "",
    freshness = { status: "unknown" },
    ...context
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

    const robots = String(metadata.robots || "");
    if (!indexable) pass("indexability", "explicitly non-indexable", 10);
    else if (!/\bnoindex\b/i.test(robots)) pass("indexability", "indexable", 10);
    else fail("indexability", "indexability mismatch: noindex directive present");

    if (url && canonical) pass("canonical", "canonical present", 10);
    else fail("canonical", "canonical missing");

    if (graphNodes.length >= 3) pass("schema", "JSON-LD graph populated", 10);
    else warn("schema", "JSON-LD graph is sparse", 5);

    if ("h1Count" in context) {
        if (context.h1Count === 1) pass("h1", "exactly one H1", 10);
        else if (context.h1Count === 0) fail("h1", "H1 missing");
        else warn("h1", "multiple H1 elements", 5);
    }

    if ("missingImageAlt" in context) {
        if (context.missingImageAlt === 0) pass("image-alt", "images have alt text", 5);
        else warn("image-alt", `${context.missingImageAlt} images missing alt text`, 2);
    }

    if (context.imageAudit && typeof context.imageAudit === "object") {
        const imageAudit = context.imageAudit;
        if ("missingDimensions" in imageAudit) {
            if (imageAudit.missingDimensions === 0) pass("image-dimensions", "images have explicit dimensions", 5);
            else warn("image-dimensions", `${imageAudit.missingDimensions} images missing dimensions`, 2);
        }
        if ("genericAlt" in imageAudit) {
            if (imageAudit.genericAlt === 0) pass("image-alt-quality", "image alt text is descriptive", 5);
            else warn("image-alt-quality", `${imageAudit.genericAlt} images have generic alt text`, 2);
        }
        if ("heroPriority" in imageAudit) {
            if (imageAudit.heroPriority === true) pass("hero-image-priority", "primary image is prioritized", 5);
            else warn("hero-image-priority", "primary image priority is not confirmed", 2);
        }
    }

    if ("wordCount" in context) {
        const wordCount = Number(context.wordCount);
        if (Number.isFinite(wordCount) && wordCount >= 0) {
            if (wordCount > 0) pass("content-depth", "visible content is present", 5);
            else warn("content-depth", "visible content is empty", 0);
        } else {
            warn("content-depth", "content depth signal is invalid", 0);
        }
    }

    if ("internalLinkCount" in context) {
        if (context.internalLinkCount >= 3) pass("internal-links", "strong internal linking", 10);
        else warn("internal-links", "few internal links", 4);
    }


    if (context.webVitals && typeof context.webVitals === "object") {
        for (const metric of ["lcp", "inp", "cls"]) {
            if (!(metric in context.webVitals)) continue;
            const value = Number(context.webVitals[metric]);
            if (!Number.isFinite(value) || value < 0) {
                warn(`web-vitals-${metric}`, `${metric.toUpperCase()} signal is invalid`, 0);
                continue;
            }
            const good = metric === "lcp" ? value <= 2500 : metric === "inp" ? value <= 200 : value <= 0.1;
            const needsImprovement = metric === "lcp" ? value <= 4000 : metric === "inp" ? value <= 500 : value <= 0.25;
            if (good) pass(`web-vitals-${metric}`, `${metric.toUpperCase()} is good`, 5);
            else if (needsImprovement) warn(`web-vitals-${metric}`, `${metric.toUpperCase()} needs improvement`, 2);
            else warn(`web-vitals-${metric}`, `${metric.toUpperCase()} is poor`, 0);
        }
    }

    if (topicSlugs.length >= 1) pass("topics", "topic signals resolved", 5);
    else warn("topics", "no topic signals resolved", 0);

    if (primaryIntent) pass("intent", `primary intent: ${primaryIntent}`, 5);
    else warn("intent", "primary intent unresolved", 0);

    if ("answerBlockCount" in context) {
        if (Number(context.answerBlockCount) > 0) pass("answer-blocks", "GEO answer blocks are available", 5);
        else warn("answer-blocks", "no GEO answer blocks supplied", 0);
    }

    if ("answerBlockSourceCount" in context) {
        const answerCount = Math.max(0, Number(context.answerBlockCount) || 0);
        const sourceCount = Math.max(0, Number(context.answerBlockSourceCount) || 0);
        if (answerCount > 0 && sourceCount >= answerCount) {
            pass("answer-sources", "GEO answer blocks have source references", 5);
        } else {
            warn("answer-sources", "GEO answer blocks lack complete source references", 2);
        }
    }

    if (context.knowledgeGraphStats && typeof context.knowledgeGraphStats === "object") {
        const nodeCount = Math.max(0, Number(context.knowledgeGraphStats.nodeCount) || 0);
        const edgeCount = Math.max(0, Number(context.knowledgeGraphStats.edgeCount) || 0);
        if (nodeCount > 0 && edgeCount > 0) pass("entity-graph", "semantic Entity Graph is connected", 5);
        else warn("entity-graph", "semantic Entity Graph has insufficient relationships", 0);
    }

    if (freshness?.status === "fresh") pass("freshness", "content freshness is healthy", 5);
    else if (freshness?.status === "aging") warn("freshness", "content is aging", 2);
    else if (freshness?.status === "stale") warn("freshness", "content is stale", 0);
    else warn("freshness", "freshness signal unavailable", 0);

    const applicablePoints = checks.reduce((sum, item) => sum + item.points, 0);
    const knownChecks = new Set([
        "title", "description", "indexability", "canonical", "schema", "h1",
        "image-alt", "image-dimensions", "image-alt-quality", "hero-image-priority",
        "content-depth", "internal-links", "web-vitals-lcp", "web-vitals-inp",
        "answer-blocks", "answer-sources", "entity-graph",
        "web-vitals-cls", "topics", "intent", "freshness"
    ]);
    const coverageChecks = checks.filter((item) => knownChecks.has(item.id));
    const coverageScore = knownChecks.size
        ? Math.round((new Set(coverageChecks.map((item) => item.id)).size / knownChecks.size) * 100)
        : 0;
    const theoreticalPoints = checks.reduce((sum, item) => {
        const max = { title: 10, description: 10, indexability: 10, canonical: 10, schema: 10, h1: 10, "image-alt": 5, "content-depth": 5,
            "image-dimensions": 5,
            "image-alt-quality": 5,
            "hero-image-priority": 5,
            "web-vitals-lcp": 5,
            "web-vitals-inp": 5,
            "web-vitals-cls": 5, "internal-links": 10, topics: 5, intent: 5,
            "answer-blocks": 5, "answer-sources": 5, "entity-graph": 5, freshness: 5 }[item.id] || item.points;
        return sum + max;
    }, 0);
    const score = theoreticalPoints ? Math.round((applicablePoints / theoreticalPoints) * 100) : 0;
    const qualityScore = Math.round(score * coverageScore / 100);

    // A fixed core rubric prevents a sparse audit payload from looking
    // complete merely because the checks that happened to be supplied passed.
    // Optional/performance checks continue to contribute through the existing
    // evidence score and coverage score.
    const coreWeights = Object.freeze({
        title: 10,
        description: 10,
        indexability: 10,
        canonical: 10,
        schema: 10,
        h1: 10,
        topics: 5,
        intent: 5
    });
    const coreChecks = Object.entries(coreWeights).map(([id, maxPoints]) => {
        const check = checks.find((item) => item.id === id);
        return {
            id,
            applicable: Boolean(check),
            points: check ? Math.min(maxPoints, Math.max(0, Number(check.points) || 0)) : 0,
            maxPoints
        };
    });
    const coreApplicablePoints = coreChecks.reduce((sum, item) => sum + item.points, 0);
    const coreMaxPoints = Object.values(coreWeights).reduce((sum, value) => sum + value, 0);
    const coreScore = coreMaxPoints
        ? Math.round((coreApplicablePoints / coreMaxPoints) * 100)
        : 0;
    const coreCoverageScore = coreMaxPoints
        ? Math.round(
            (coreChecks.filter((item) => item.applicable).reduce((sum, item) => sum + item.maxPoints, 0) / coreMaxPoints) * 100
        )
        : 0;
    const missingCoreChecks = coreChecks
        .filter((item) => !item.applicable)
        .map((item) => item.id);
    const errors = checks.filter((item) => item.status === "fail");
    const warnings = checks.filter((item) => item.status === "warn");

    return Object.freeze({
        score,
        coverageScore,
        qualityScore,
        coreScore,
        coreCoverageScore,
        missingCoreChecks: Object.freeze(missingCoreChecks),
        status: errors.length ? "error" : warnings.length ? "warning" : "pass",
        checks,
        errors,
        warnings,
        summary: {
            url,
                score,
            coverageScore,
            qualityScore,
            coreScore,
            coreCoverageScore,
            missingCoreChecks: missingCoreChecks.length,
            errors: errors.length,
            warnings: warnings.length,
            graphNodes: graphNodes.length,
            topics: topicSlugs.length,
            primaryIntent
        }
    });
}
