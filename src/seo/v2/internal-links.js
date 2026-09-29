import { findRelatedEntities, findRelationPaths } from "./knowledge-graph.js";
import { normalizeSemanticText } from "../helpers/text.js";
import { queryTokens } from "../helpers/query.js";
import { normalizeUrl } from "../helpers/url.js";

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
    const a = new Set(queryTokens((left || []).join(" ")));
    const b = new Set(queryTokens((right || []).join(" ")));
    if (!a.size || !b.size) return 0;
    let shared = 0;
    for (const token of a) if (b.has(token)) shared += 1;
    return shared / new Set([...a, ...b]).size;
}

function buildCandidateTokenIndex(pages = []) {
    const index = new Map();
    for (const page of pages) {
        if (!page?.url) continue;
        const tokens = new Set(
            queryTokens([
                page.title,
                ...(page.topics || [])
            ].filter(Boolean).join(" "))
        );
        for (const token of tokens) {
            const bucket = index.get(token) || [];
            bucket.push(page);
            index.set(token, bucket);
        }
    }
    return index;
}

function buildCandidatePool(source, pages, tokenIndex, {
    maxCandidates = 120,
    fullScanThreshold = 160,
    semanticGraph = null
} = {}) {
    if (pages.length <= fullScanThreshold) return pages;

    const selected = new Map();
    const sourceTokens = new Set(
        queryTokens([
            source?.title,
            ...(source?.topics || [])
        ].filter(Boolean).join(" "))
    );

    for (const token of sourceTokens) {
        for (const page of tokenIndex.get(token) || []) {
            if (page?.url) selected.set(normalizeUrl(page.url), page);
        }
    }

    // Large graphs cannot rely only on token overlap. Entity relationships can
    // legitimately connect pages whose visible vocabulary is different, such
    // as a course and its instructor. Pull direct graph neighbors into the
    // candidate pool before applying the deterministic cap.
    if (semanticGraph?.nodes?.length && semanticGraph?.edges?.length && source?.url) {
        const sourceNode = semanticGraph.nodes.find(
            (node) => normalizeUrl(node?.url) === normalizeUrl(source.url)
        );
        if (sourceNode?.id) {
            for (const related of findRelatedEntities(semanticGraph, sourceNode.id, {
                direction: "both",
                limit: Math.max(20, Number(maxCandidates) || 120)
            })) {
                const relatedUrl = normalizeUrl(related.entity?.url);
                if (!relatedUrl) continue;
                const page = pages.find((candidate) => normalizeUrl(candidate?.url) === relatedUrl);
                if (page?.url) selected.set(relatedUrl, page);
            }
        }
    }

    for (const page of pages) {
        if (!page?.url) continue;
        const important =
            Number(page.priority || 0) >= 20 ||
            page.type === "Course" ||
            page.type === "CollectionPage" ||
            page.type === "LocalBusiness";
        if (important) selected.set(normalizeUrl(page.url), page);
    }

    return [...selected.values()]
        .sort((a, b) =>
            Number(b.priority || 0) - Number(a.priority || 0) ||
            String(a.url).localeCompare(String(b.url))
        )
        .slice(0, Math.max(20, Number(maxCandidates) || 120));
}

export function buildInternalLinkPlan({ currentUrl = "", currentTitle = "", currentTopics = [], currentType = "", candidates = /** @type {LinkCandidate[]} */ ([]), semanticGraph = null, gscSignals = null, gscOwnership = [], limit = 6 } = {}) {
    const currentTopicSet = normalizedTopicSet(currentTopics);
    const resolvedCurrentTitle = currentTitle || (candidates || []).find((candidate) => normalizeUrl(candidate?.url) === normalizeUrl(currentUrl))?.title || "";
    const currentContext = [resolvedCurrentTitle, ...(currentTopics || [])].filter(Boolean).join(" ");
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
            const ownerEvidence = findStrongOwnershipEvidence(candidate.url, gscOwnership, candidate);
            if (ownerEvidence.status === "STRONG") score += 8;
            else if (ownerEvidence.status === "MODERATE") score += 3;
            else if (ownerEvidence.status === "SPLIT") score -= 4;
            const reasonCodes = [];
            if (sharedTopics.length) reasonCodes.push("SHARED_TOPIC");
            if (topicalSimilarity >= 0.35) reasonCodes.push("SEMANTIC_SIMILARITY");
            if (relationEvidence.score > 0) reasonCodes.push("ENTITY_RELATION");
            if (ownerEvidence.status === "STRONG") reasonCodes.push("GSC_OWNER_STRONG");
            else if (ownerEvidence.status === "MODERATE") reasonCodes.push("GSC_OWNER_MODERATE");
            else if (ownerEvidence.status === "SPLIT") reasonCodes.push("GSC_OWNER_SPLIT");
            if (
                (currentType === "Course" && candidate.type === "Instructor") ||
                (currentType === "Instructor" && candidate.type === "Course") ||
                (currentType === "Article" && candidate.type === "Course") ||
                (currentType === "Course" && candidate.type === "Article")
            ) reasonCodes.push("ENTITY_COMPLEMENT");
            if (candidate.local) score += 8;

            const demandSignal = getCandidateSearchSignal(candidate, gscSignals);
            const demandBoost = searchDemandBoost(demandSignal);
            if (demandBoost > 0) {
                score += demandBoost;
                reasonCodes.push("SEARCH_DEMAND");
            }

            if (currentType === "Course" && candidate.type === "Instructor") score += 22;
            if (currentType === "Instructor" && candidate.type === "Course") score += 22;
            if (currentType === "Course" && candidate.type === "Article") score += 14;
            if (currentType === "Article" && candidate.type === "Course") score += 18;
            if (candidate.type === "Course") score += 5;
            const anchorHints = buildAnchorHints(candidate, sharedTopics, relationEvidence.relations);
            return {
                ...candidate,
                score,
                sharedTopics,
                topicalSimilarity: Number(topicalSimilarity.toFixed(3)),
                relationEvidence: relationEvidence.relations,
                reasonCodes: Object.freeze([...new Set(reasonCodes)]),
                anchorHints: Object.freeze(anchorHints),
                searchDemand: demandSignal?.available ? Object.freeze({
                    impressions: Number(demandSignal.impressions) || 0,
                    clicks: Number(demandSignal.clicks) || 0,
                    ctr: Number(demandSignal.ctr) || 0,
                    position: demandSignal.position ?? null
                }) : null
            };
        })
        .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), "fa"))
        .slice(0, Math.max(0, limit));
}

/**
 * Produce a compact graph used by templates or build-time tooling.
 */
export function buildLinkGraph(pages = [], { semanticGraph = null, gscSignals = null, gscOwnership = [], limit = 6, maxInboundLinks = 12, maxOutboundLinks = limit } = {}) {
    const normalizedLimit = Math.max(0, Number(maxOutboundLinks) || 0);
    const normalizedInboundCap = Math.max(0, Number(maxInboundLinks) || 0);
    const sourcePages = [...(pages || [])]
        .filter((page) => page?.url)
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.url).localeCompare(String(b.url)));

    const allEdges = new Map();
    const candidateTokenIndex = buildCandidateTokenIndex(sourcePages);
    for (const page of sourcePages) {
        const candidatePool = buildCandidatePool(page, sourcePages, candidateTokenIndex, {
            semanticGraph
        });
        const plan = buildInternalLinkPlan({
            currentUrl: page.url,
            currentTitle: page.title,
            currentTopics: page.topics,
            currentType: page.type,
            candidates: candidatePool,
            semanticGraph,
            gscSignals,
            gscOwnership,
            limit: candidatePool.length
        });
        allEdges.set(
            normalizeUrl(page.url),
            plan.map((link) => ({
                ...link,
                sourceUrl: page.url
            }))
        );
    }

    const inboundCounts = new Map();
    const selectedBySource = new Map();
    const assignedPairs = new Set();

    // Allocate links globally rather than letting every page independently
    // choose the same popular target. This makes maxInboundLinks a real cap.
    for (const page of sourcePages) {
        const candidates = allEdges.get(normalizeUrl(page.url)) || [];
        const selected = [];

        // Select links iteratively so the current global inbound count actually
        // influences the next choice. This turns saturation from a report-only
        // field into a real allocation penalty.
        while (selected.length < normalizedLimit) {
            let best = null;

            for (const link of candidates) {
                const target = normalizeUrl(link.url);
                const pairKey = normalizeUrl(page.url) + "=>" + target;
                if (assignedPairs.has(pairKey)) continue;

                const inboundBefore = inboundCounts.get(target) || 0;
                if (normalizedInboundCap > 0 && inboundBefore >= normalizedInboundCap) continue;

                const saturationPenalty = Math.min(20, inboundBefore * 2);
                const orphanBoost = inboundBefore === 0 ? 10 : 0;
                const effectiveScore = link.score - saturationPenalty + orphanBoost;

                if (
                    !best ||
                    effectiveScore > best.effectiveScore ||
                    (effectiveScore === best.effectiveScore && String(link.title).localeCompare(String(best.link.title), "fa") < 0)
                ) {
                    best = {
                        link,
                        target,
                        pairKey,
                        inboundBefore,
                        saturationPenalty,
                        orphanBoost,
                        effectiveScore
                    };
                }
            }

            if (!best) break;

            selected.push({
                ...best.link,
                finalScore: best.effectiveScore,
                inboundLinksBeforePlan: best.inboundBefore,
                inboundLinksAfterPlan: best.inboundBefore + 1,
                saturationPenalty: best.saturationPenalty,
                orphanBoost: best.orphanBoost
            });
            inboundCounts.set(best.target, best.inboundBefore + 1);
            assignedPairs.add(best.pairKey);
        }

        selectedBySource.set(normalizeUrl(page.url), selected);
    }

    // Give still-orphaned targets one deterministic recovery link where a
    // source has spare capacity. This prevents a strict inbound cap from
    // turning useful pages into permanent orphans.
    for (const targetPage of sourcePages) {
        const target = normalizeUrl(targetPage.url);
        if ((inboundCounts.get(target) || 0) > 0) continue;

        let best = null;
        for (const source of sourcePages) {
            if (normalizeUrl(source.url) === target) continue;
            const selected = selectedBySource.get(normalizeUrl(source.url)) || [];
            if (selected.length >= normalizedLimit) continue;

            const candidate = (allEdges.get(normalizeUrl(source.url)) || [])
                .find((link) => normalizeUrl(link.url) === target && !assignedPairs.has(normalizeUrl(source.url) + "=>" + target));
            if (!candidate) continue;

            const score = candidate.score + 14 + Number(source.priority || 0) * 0.05;
            if (!best || score > best.score || (score === best.score && String(source.url).localeCompare(String(best.source.url)) < 0)) {
                best = { source, candidate, score };
            }
        }

        if (!best) continue;

        const sourceKey = normalizeUrl(best.source.url);
        const selected = selectedBySource.get(sourceKey) || [];
        selected.push({
            ...best.candidate,
            finalScore: best.score,
            inboundLinksBeforePlan: 0,
            inboundLinksAfterPlan: 1,
            saturationPenalty: 0,
            orphanBoost: 14
        });
        selectedBySource.set(sourceKey, selected);
        inboundCounts.set(target, 1);
        assignedPairs.add(sourceKey + "=>" + target);
    }

    return sourcePages.map((page) => ({
        url: page.url,
        links: (selectedBySource.get(normalizeUrl(page.url)) || [])
            .sort((a, b) => b.finalScore - a.finalScore || String(a.title).localeCompare(String(b.title), "fa"))
            .slice(0, normalizedLimit)
            .map(({ url, title, type, score, finalScore, topicalSimilarity, relationEvidence, reasonCodes, anchorHints, searchDemand, inboundLinksBeforePlan, inboundLinksAfterPlan, saturationPenalty, orphanBoost, sharedTopics }) => ({
                url, title, type, score, finalScore, topicalSimilarity, relationEvidence, reasonCodes, anchorHints, searchDemand,
                inboundLinksBeforePlan, inboundLinksAfterPlan, saturationPenalty, orphanBoost, sharedTopics
            }))
    }));
}

function findStrongOwnershipEvidence(candidateUrl, ownership = [], candidate = {}) {
    const normalized = normalizeUrl(candidateUrl);
    const candidateTokens = queryTokens([
        candidate?.title,
        ...(candidate?.topics || [])
    ].filter(Boolean).join(" "));
    const matches = (Array.isArray(ownership) ? ownership : [])
        .filter((item) => normalizeUrl(item?.topPage) === normalized)
        .filter((item) => {
            const querySet = queryTokens(item?.query || item?.displayQuery || "");
            if (!querySet.size || !candidateTokens.size) return false;
            let shared = 0;
            for (const token of querySet) if (candidateTokens.has(token)) shared += 1;
            const queryCoverage = shared / querySet.size;
            const candidateCoverage = shared / candidateTokens.size;
            const overlap = shared / new Set([...querySet, ...candidateTokens]).size;
            return querySet.size === 1
                ? queryCoverage === 1
                : queryCoverage >= 0.5 && candidateCoverage >= 0.2 && overlap >= 0.2;
        });

    if (!matches.length) return { status: "NONE" };
    const strongest = matches
        .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))[0];

    return {
        status:
            strongest?.ownerStatus === "SPLIT" ? "SPLIT" :
            strongest?.ownerDominanceEvidence === "STRONG" && strongest?.ownerStatus === "STABLE" ? "STRONG" :
            strongest?.ownerStatus === "STABLE" ? "MODERATE" :
            "NONE"
    };
}

function getCandidateSearchSignal(candidate, gscSignals) {
    if (!gscSignals || !candidate?.url) return null;
    if (gscSignals instanceof Map) return gscSignals.get(normalizeUrl(candidate.url)) || null;
    if (typeof gscSignals === "object") return gscSignals[normalizeUrl(candidate.url)] || null;
    return null;
}

function searchDemandBoost(signal = null) {
    if (!signal?.available) return 0;
    const impressions = Math.max(0, Number(signal.impressions) || 0);
    const position = Number(signal.position);
    if (impressions <= 0) return 0;

    let boost =
        impressions >= 1000 ? 10 :
        impressions >= 300 ? 8 :
        impressions >= 100 ? 6 :
        impressions >= 20 ? 4 :
        2;

    if (Number.isFinite(position) && position > 10 && position <= 30) boost += 2;
    return Math.min(12, boost);
}

function buildAnchorHints(candidate, sharedTopics = [], relations = []) {
    const hints = [];
    if (candidate?.title) hints.push(String(candidate.title).trim());
    for (const topic of sharedTopics || []) {
        if (topic) hints.push(String(topic).trim());
    }
    for (const relation of relations || []) {
        const relationText = String(relation || "").replace(/^reverse:/, "").replace(/^path:/, "").trim();
        if (relationText === "teaches") hints.push("مدرس دوره");
        else if (relationText === "about") hints.push("راهنمای مرتبط");
        else if (relationText === "provider") hints.push("دوره آموزشگاه");
        else if (relationText === "location") hints.push("کلاس در شوشتر");
    }
    return [...new Set(hints.filter(Boolean))].slice(0, 4);
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
