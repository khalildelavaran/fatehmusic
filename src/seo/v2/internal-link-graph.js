/**
 * Fateh Music SEO/GEO Engine v2
 * Autonomous internal-link graph planner.
 * Deterministic, explainable and URL-safe: it only links known pages.
 */

const TYPE_WEIGHT = {
  Course: 18,
  Instructor: 14,
  Article: 10,
  Location: 12,
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "course", "article",
  "آموزش", "دوره", "مقاله", "برای", "در", "با", "و", "به", "از"
]);

function tokens(value = "") {
  return new Set(
    String(value)
      .toLocaleLowerCase("fa-IR")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOPWORDS.has(token))
  );
}

function jaccard(a, b) {
  const left = a instanceof Set ? a : tokens(a);
  const right = b instanceof Set ? b : tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function semanticScore(source, target) {
  const sourceTopics = new Set(source.topics || []);
  const targetTopics = new Set(target.topics || []);
  const topicScore = jaccard(sourceTopics, targetTopics);
  const entityScore = jaccard(tokens(source.entity || ""), tokens(target.entity || ""));
  const titleScore = jaccard(tokens(source.title || ""), tokens(target.title || ""));
  const typeScore = source.type && target.type && source.type !== target.type ? 1 : 0;
  const localScore = source.local && target.local ? 1 : 0;

  return (
    topicScore * 42 +
    entityScore * 23 +
    titleScore * 15 +
    typeScore * 8 +
    localScore * 7 +
    Math.min(10, Number(target.priority || 0) / 10)
  );
}

/**
 * Builds ranked source→target recommendations for an existing page graph.
 * No URL is generated; every target must exist in the supplied graph.
 */
export function buildAutonomousLinkGraph(pages = [], options = {}) {
  const limit = Math.max(1, Number(options.limit || 6));
  const minScore = Number(options.minScore ?? 18);
  const graph = [];

  for (const source of pages || []) {
    if (!source?.url) continue;

    const links = (pages || [])
      .filter((target) => target?.url && target.url !== source.url)
      .map((target) => {
        const score = semanticScore(source, target) + Number(TYPE_WEIGHT[target.type] || 0);
        const reasons = [];
        if (jaccard(new Set(source.topics || []), new Set(target.topics || [])) > 0) reasons.push("shared-topic");
        if (jaccard(tokens(source.entity || ""), tokens(target.entity || "")) > 0) reasons.push("shared-entity");
        if (source.local && target.local) reasons.push("local-authority");
        if (TYPE_WEIGHT[target.type]) reasons.push(`target-${String(target.type).toLowerCase()}`);
        return {
          sourceUrl: source.url,
          targetUrl: target.url,
          targetTitle: target.title || target.url,
          targetType: target.type || "Page",
          score: Math.round(score * 100) / 100,
          reasons,
        };
      })
      .filter((link) => link.score >= minScore)
      .sort((a, b) => b.score - a.score || a.targetUrl.localeCompare(b.targetUrl, "fa"))
      .slice(0, limit);

    graph.push({ sourceUrl: source.url, links });
  }

  return graph;
}

/**
 * Converts a graph into dashboard-ready opportunities without mutating source data.
 */
export function buildLinkOpportunities(pages = [], options = {}) {
  return buildAutonomousLinkGraph(pages, options).flatMap((node) =>
    node.links.map((link) => ({
      action: "LINK",
      sourceUrl: link.sourceUrl,
      targetUrl: link.targetUrl,
      targetTitle: link.targetTitle,
      targetType: link.targetType,
      priority: Math.min(100, Math.round(link.score)),
      reasons: link.reasons,
    }))
  );
}
