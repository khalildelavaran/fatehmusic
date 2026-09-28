import { findRelatedEntities } from "./knowledge-graph.js";

/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Semantic internal-link planner.
 * It ranks existing pages; it never invents URLs.
 * --------------------------------------------------------
 */

/**
 * @typedef {{url:string,title:string,type?:string,topics?:string[],priority?:number,local?:boolean}} LinkCandidate
 */

/**
 * @param {{currentUrl?:string, currentTopics?:string[], currentType?:string, candidates?:LinkCandidate[], limit?:number}} input
 */
export function buildInternalLinkPlan({ currentUrl = "", currentTopics = [], currentType = "", candidates = [], semanticGraph = null, limit = 6 } = {}) {
    const currentTopicSet = new Set(currentTopics || []);
    return (candidates || [])
        .filter((candidate) => candidate?.url && candidate.url !== currentUrl)
        .map((candidate) => {
            const sharedTopics = (candidate.topics || []).filter((topic) => currentTopicSet.has(topic));
            let score = Number(candidate.priority || 0);
            score += sharedTopics.length * 25;

            const relationEvidence = findRelationEvidence(currentUrl, candidate.url, semanticGraph);
            score += relationEvidence.score;
            if (candidate.local) score += 8;
            if (currentType === "Course" && candidate.type === "Instructor") score += 22;
            if (currentType === "Instructor" && candidate.type === "Course") score += 22;
            if (currentType === "Course" && candidate.type === "Article") score += 14;
            if (currentType === "Article" && candidate.type === "Course") score += 18;
            if (candidate.type === "Course") score += 5;
            return { ...candidate, score, sharedTopics, relationEvidence: relationEvidence.relations };
        })
        .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), "fa"))
        .slice(0, Math.max(0, limit));
}

/**
 * Produce a compact graph used by templates or build-time tooling.
 */
export function buildLinkGraph(pages = [], { semanticGraph = null } = {}) {
    return pages.map((page) => ({
        url: page.url,
        links: buildInternalLinkPlan({
            currentUrl: page.url,
            currentTopics: page.topics,
            currentType: page.type,
            candidates: pages,
            semanticGraph
        }).map(({ url, title, type, score, relationEvidence }) => ({ url, title, type, score, relationEvidence }))
    }));
}

function normalizeUrl(value) {
    const normalized = String(value || "").replace(/\/$/, "").trim().toLowerCase();
    return normalized || "/";
}

function findRelationEvidence(currentUrl, candidateUrl, semanticGraph) {
    if (!semanticGraph?.nodes?.length || !semanticGraph?.edges?.length) {
        return { score: 0, relations: [] };
    }

    const current = semanticGraph.nodes.find((node) => normalizeUrl(node.url) === normalizeUrl(currentUrl));
    const candidate = semanticGraph.nodes.find((node) => normalizeUrl(node.url) === normalizeUrl(candidateUrl));
    if (!current?.id || !candidate?.id) return { score: 0, relations: [] };

    const related = findRelatedEntities(semanticGraph, current.id, { direction: "both", limit: 100 })
      .filter((item) => item.entity?.id === candidate.id);

    if (!related.length) return { score: 0, relations: [] };

    const weights = {
        teaches: 45,
        about: 40,
        worksFor: 30,
        location: 25,
        provider: 20,
        publisher: 12
    };

    return {
        score: Math.max(...related.map((item) => (weights[item.relation] || 10) * Math.max(0.5, item.confidence))),
        relations: [...new Set(related.map((item) =>
          item.direction === "out" ? item.relation : "reverse:" + item.relation
        ))]
    };
}
