import { findRelatedEntities, findRelationPaths } from "./knowledge-graph.js";
import { normalizeSemanticText, semanticTokens } from "../helpers/text.js";

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
function normalizedTopicSet(values = []) {
    return new Set(
        (values || [])
            .map((value) => normalizeSemanticText(value))
            .filter(Boolean)
    );
}

function semanticTopicSimilarity(left = [], right = []) {
    const a = new Set(semanticTokens((left || []).join(" ")));
    const b = new Set(semanticTokens((right || []).join(" ")));
    if (!a.size || !b.size) return 0;
    let shared = 0;
    for (const token of a) if (b.has(token)) shared += 1;
    return shared / new Set([...a, ...b]).size;
}

export function buildInternalLinkPlan({ currentUrl = "", currentTopics = [], currentType = "", candidates = [], semanticGraph = null, limit = 6 } = {}) {
    const currentTopicSet = normalizedTopicSet(currentTopics);
    const currentTitle = (candidates || []).find((candidate) => normalizeUrl(candidate?.url) === normalizeUrl(currentUrl))?.title || "";
    const currentContext = [currentTitle, ...(currentTopics || [])].filter(Boolean).join(" ");
    return (candidates || [])
        .filter((candidate) => candidate?.url && normalizeUrl(candidate.url) !== normalizeUrl(currentUrl))
        .map((candidate) => {
            const candidateTopics = normalizedTopicSet(candidate.topics);
            const sharedTopics = [...candidateTopics].filter((topic) => currentTopicSet.has(topic));
            const topicalSimilarity = semanticTopicSimilarity(
                [currentContext],
                [candidate.title, ...(candidate.topics || [])].filter(Boolean)
            );
            let score = Number(candidate.priority || 0);
            score += sharedTopics.length * 25;
            score += Math.round(topicalSimilarity * 30);

            const relationEvidence = findRelationEvidence(currentUrl, candidate.url, semanticGraph);
            score += relationEvidence.score;
            if (candidate.local) score += 8;
            if (currentType === "Course" && candidate.type === "Instructor") score += 22;
            if (currentType === "Instructor" && candidate.type === "Course") score += 22;
            if (currentType === "Course" && candidate.type === "Article") score += 14;
            if (currentType === "Article" && candidate.type === "Course") score += 18;
            if (candidate.type === "Course") score += 5;
            return {
                ...candidate,
                score,
                sharedTopics,
                topicalSimilarity: Number(topicalSimilarity.toFixed(3)),
                relationEvidence: relationEvidence.relations
            };
        })
        .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), "fa"))
        .slice(0, Math.max(0, limit));
}

/**
 * Produce a compact graph used by templates or build-time tooling.
 */
export function buildLinkGraph(pages = [], { semanticGraph = null, limit = 6, maxInboundLinks = 12 } = {}) {
    const inboundCounts = new Map();
    for (const page of pages || []) {
        const plan = buildInternalLinkPlan({
            currentUrl: page.url,
            currentTopics: page.topics,
            currentType: page.type,
            candidates: pages,
            semanticGraph,
            limit: pages.length
        });
        for (const link of plan) inboundCounts.set(normalizeUrl(link.url), (inboundCounts.get(normalizeUrl(link.url)) || 0) + 1);
    }

    return (pages || []).map((page) => ({
        url: page.url,
        links: buildInternalLinkPlan({
            currentUrl: page.url,
            currentTopics: page.topics,
            currentType: page.type,
            candidates: pages,
            semanticGraph,
            limit: pages.length
        })
            .map((link) => {
                const inbound = inboundCounts.get(normalizeUrl(link.url)) || 0;
                const saturationPenalty = inbound > maxInboundLinks
                    ? Math.min(15, inbound - maxInboundLinks)
                    : 0;
                const orphanBoost = inbound === 0 ? 10 : 0;
                return {
                    ...link,
                    finalScore: link.score - saturationPenalty + orphanBoost,
                    inboundLinksBeforePlan: inbound,
                    saturationPenalty,
                    orphanBoost
                };
            })
            .sort((a, b) => b.finalScore - a.finalScore || String(a.title).localeCompare(String(b.title), "fa"))
            .slice(0, Math.max(0, limit))
            .map(({ url, title, type, score, finalScore, topicalSimilarity, relationEvidence, inboundLinksBeforePlan, saturationPenalty, orphanBoost }) => ({
                url, title, type, score, finalScore, topicalSimilarity, relationEvidence,
                inboundLinksBeforePlan, saturationPenalty, orphanBoost
            }))
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

    const weights = {
        teaches: 45,
        about: 40,
        worksFor: 30,
        location: 25,
        provider: 20,
        publisher: 12,
        knowsAbout: 28
    };

    if (related.length) {
        return {
            score: Math.max(...related.map((item) => (weights[item.relation] || 10) * Math.max(0.5, item.confidence))),
            relations: [...new Set(related.map((item) =>
              item.direction === "out" ? item.relation : "reverse:" + item.relation
            ))]
        };
    }

    const paths = findRelationPaths(semanticGraph, current.id, candidate.id, {
        maxDepth: 2,
        relations: ["about", "knowsAbout"],
        direction: "both",
        limit: 3
    });

    if (!paths.length) return { score: 0, relations: [] };

    const bestPath = paths[0];
    return {
        score: Math.round(18 * Math.max(0.5, bestPath.confidence)),
        relations: [...new Set(bestPath.edges.map((edge) => "path:" + edge.relation))]
    };
}
