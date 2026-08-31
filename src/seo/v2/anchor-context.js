/**
 * Anchor & Context Intelligence v1
 *
 * Generates deterministic internal-link anchor/context suggestions from
 * already-known content graph nodes. It never invents URLs and never mutates
 * source content.
 */

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "در", "از", "به", "با", "برای", "و", "را", "که", "این", "آن"
]);

function tokens(value = "") {
  return String(value)
    .toLocaleLowerCase("fa-IR")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

function similarity(a = "", b = "") {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function targetLabel(target) {
  return target.anchorLabel || target.title || target.name || target.url || "";
}

function extractSentences(source) {
  const text = [source.excerpt, source.description, source.content, source.body]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];
  return text
    .split(/(?<=[.!؟?؛])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 280);
}

function scoreContext(sentence, target, source = {}) {
  const label = targetLabel(target);
  const sentenceScore = similarity(sentence, label);
  const topicScore = similarity(sentence, (target.topics || []).join(" "));
  const entityScore = similarity(sentence, (target.entities || []).join(" "));
  const sourceTopicScore = similarity((source.topics || []).join(" "), (target.topics || []).join(" "));
  const score = Math.round(
    sentenceScore * 45 + topicScore * 25 + entityScore * 20 + sourceTopicScore * 10
  );
  return { score, sentenceScore, topicScore, entityScore, sourceTopicScore };
}

export function suggestAnchorCandidates(target, source = {}) {
  const labels = [
    target.anchorLabel,
    target.title,
    target.name,
    ...(target.entities || []),
    ...(target.topics || [])
  ].filter(Boolean);

  return [...new Set(labels)]
    .map((anchor) => ({ anchor, score: Math.round(similarity(anchor, targetLabel(target)) * 100) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function buildAnchorContextRecommendation(source, target) {
  if (!source?.url || !target?.url || source.url === target.url) return null;

  const sentences = extractSentences(source);
  const contexts = sentences
    .map((sentence) => ({ sentence, ...scoreContext(sentence, target, source) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const anchors = suggestAnchorCandidates(target, source);
  const bestContext = contexts[0] || null;
  const bestAnchor = anchors[0]?.anchor || targetLabel(target);

  return {
    action: "LINK",
    sourceUrl: source.url,
    targetUrl: target.url,
    anchor: bestAnchor,
    anchorCandidates: anchors,
    context: bestContext?.sentence || null,
    score: bestContext?.score ?? 0,
    reasons: [
      ...(bestContext?.topicScore > 0 ? ["topic-match"] : []),
      ...(bestContext?.entityScore > 0 ? ["entity-match"] : []),
      ...(bestContext?.sentenceScore > 0 ? ["context-match"] : []),
      ...(bestContext?.sourceTopicScore > 0 ? ["source-target-topical-alignment"] : [])
    ]
  };
}

export function buildAnchorContextRecommendations(sources = [], targets = [], options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 5;
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 35;
  const results = [];

  for (const source of sources) {
    for (const target of targets) {
      const recommendation = buildAnchorContextRecommendation(source, target);
      if (recommendation && recommendation.score >= minScore) results.push(recommendation);
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
