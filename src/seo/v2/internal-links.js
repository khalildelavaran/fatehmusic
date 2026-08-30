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
export function buildInternalLinkPlan({ currentUrl = "", currentTopics = [], currentType = "", candidates = [], limit = 6 } = {}) {
    const currentTopicSet = new Set(currentTopics || []);
    return (candidates || [])
        .filter((candidate) => candidate?.url && candidate.url !== currentUrl)
        .map((candidate) => {
            const sharedTopics = (candidate.topics || []).filter((topic) => currentTopicSet.has(topic));
            let score = Number(candidate.priority || 0);
            score += sharedTopics.length * 25;
            if (candidate.local) score += 8;
            if (currentType === "Course" && candidate.type === "Instructor") score += 22;
            if (currentType === "Instructor" && candidate.type === "Course") score += 22;
            if (currentType === "Course" && candidate.type === "Article") score += 14;
            if (currentType === "Article" && candidate.type === "Course") score += 18;
            if (candidate.type === "Course") score += 5;
            return { ...candidate, score, sharedTopics };
        })
        .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), "fa"))
        .slice(0, Math.max(0, limit));
}

/**
 * Produce a compact graph used by templates or build-time tooling.
 */
export function buildLinkGraph(pages = []) {
    return pages.map((page) => ({
        url: page.url,
        links: buildInternalLinkPlan({
            currentUrl: page.url,
            currentTopics: page.topics,
            currentType: page.type,
            candidates: pages
        }).map(({ url, title, type, score }) => ({ url, title, type, score }))
    }));
}
