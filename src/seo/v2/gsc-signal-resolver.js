/** Resolve cached GSC query/page rows into opportunity-level search signals. */
import { classifyIntent } from "./intents.js";
import { resolveTopics } from "./topics.js";

function normalizeUrl(value) {
  return String(value || "").replace(/#.*$/, "").replace(/\/$/, "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .trim()
    .toLowerCase();
}

function tokens(value) {
  return normalizeText(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
}

function jaccard(a = [], b = []) {
  const left = new Set(a), right = new Set(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((item) => right.has(item)).length;
  return intersection / new Set([...left, ...right]).size;
}

export function aggregate(rows = []) {
  const total = rows.reduce((acc, row) => {
    const impressions = Math.max(0, Number(row.impressions) || 0);
    const clicks = Math.max(0, Number(row.clicks) || 0);
    return {
      clicks: acc.clicks + clicks,
      impressions: acc.impressions + impressions,
      weightedPosition: acc.weightedPosition + impressions * Math.max(0, Number(row.position) || 0)
    };
  }, { clicks: 0, impressions: 0, weightedPosition: 0 });
  return {
    available: total.impressions > 0 || total.clicks > 0,
    impressions: total.impressions,
    clicks: total.clicks,
    ctr: total.impressions ? total.clicks / total.impressions : 0,
    position: total.impressions ? total.weightedPosition / total.impressions : null,
    source: "google-search-console"
  };
}

function scoreRow(row) {
  const impressions = Math.max(0, Number(row.impressions) || 0);
  const clicks = Math.max(0, Number(row.clicks) || 0);
  const ctr = impressions ? clicks / impressions : 0;
  const position = Number(row.position) || 0;
  let score = 0;
  if (impressions >= 1000) score += 40;
  else if (impressions >= 300) score += 30;
  else if (impressions >= 100) score += 20;
  else if (impressions > 0) score += 10;
  if (position >= 4 && position <= 10) score += 35;
  else if (position > 10 && position <= 20) score += 25;
  else if (position > 20 && position <= 50) score += 10;
  if (ctr < 0.03) score += 20;
  else if (ctr < 0.06) score += 10;
  return Math.min(100, score);
}

export function buildGscSignalIndex(rows = []) {
  const pageRows = new Map();
  const queryRows = new Map();
  const opportunities = [];

  for (const row of rows) {
    const page = normalizeUrl(row.page);
    const query = normalizeText(row.query);
    if (!page && !query) continue;
    const item = {
      page: row.page || null,
      query: row.query || null,
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      ctr: Number(row.ctr) || 0,
      position: Number(row.position) || 0,
      dataState: row.dataState || row.data_state || "final"
    };
    if (page) pageRows.set(page, [...(pageRows.get(page) || []), item]);
    if (query) queryRows.set(query, [...(queryRows.get(query) || []), item]);
    opportunities.push(Object.freeze({ ...item, opportunitySignalScore: scoreRow(item) }));
  }

  return Object.freeze({
    byPage: new Map([...pageRows].map(([key, values]) => [key, aggregate(values)])),
    byQuery: new Map([...queryRows].map(([key, values]) => [key, aggregate(values)])),
    opportunities: Object.freeze(opportunities.sort((a, b) => b.opportunitySignalScore - a.opportunitySignalScore))
  });
}

function getCandidatePages(item) {
  return [item.url, item.targetEntity?.url].filter(Boolean).map(normalizeUrl);
}

function queryMatches(item, query) {
  const haystack = normalizeText([item.title, item.topicName, item.topic, item.course?.title].filter(Boolean).join(" | "));
  const normalizedQuery = normalizeText(query);
  if (!haystack || !normalizedQuery) return false;
  const queryTokens = tokens(normalizedQuery);
  const haystackTokens = tokens(haystack);
  return haystack.includes(normalizedQuery) || jaccard(queryTokens, haystackTokens) >= 0.45;
}

export function resolveOpportunitySearchSignals(opportunities = [], index) {
  if (!index) return opportunities;
  return opportunities.map((item) => {
    const pageSignals = getCandidatePages(item).map((page) => index.byPage.get(page)).filter(Boolean);
    const querySignals = index.opportunities.filter((row) => queryMatches(item, row.query)).slice(0, 10);
    const candidates = [...pageSignals, aggregate(querySignals)];
    const best = candidates.find((signal) => signal?.available) || { available: false, impressions: 0, clicks: 0, ctr: 0, position: null };
    return Object.freeze({ ...item, searchSignal: best, searchSignalSource: best.available ? "google-search-console" : "none" });
  });
}

function inferSemanticProfile(query, page) {
  const title = query || page || "";
  const intent = classifyIntent({ path: page || "/", title, keywords: [title], entityType: "Article" }).primary;
  const topics = resolveTopics({ title, keywords: [title], path: page || "/" }).map((topic) => topic.slug);
  const pageTokens = tokens(page);
  return { intent, topics, pageTokens };
}

function competitionScore(query, pages) {
  const profiles = pages.map((item) => ({ ...item, semantic: inferSemanticProfile(query, item.page) }));
  const pairScores = [];
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const a = profiles[i].semantic, b = profiles[j].semantic;
      const intent = a.intent === b.intent ? 1 : 0;
      const topic = jaccard(a.topics, b.topics);
      const entity = jaccard(a.pageTokens, b.pageTokens);
      pairScores.push({ score: Math.round((0.4 + intent * 0.3 + topic * 0.2 + entity * 0.1) * 100), intentSimilarity: intent, topicSimilarity: topic, entitySimilarity: entity, pages: [profiles[i].page, profiles[j].page] });
    }
  }
  return pairScores.sort((a, b) => b.score - a.score)[0] || null;
}

/** Detect likely cannibalization; shared query alone is never enough for HIGH. */
export function detectSearchCannibalization(rows = [], { minImpressions = 50, highThreshold = 75 } = {}) {
  const groups = new Map();
  for (const row of rows) {
    const query = normalizeText(row.query);
    const page = normalizeUrl(row.page);
    const impressions = Math.max(0, Number(row.impressions) || 0);
    if (!query || !page || impressions < minImpressions) continue;
    const pages = groups.get(query) || new Map();
    const previous = pages.get(page) || { impressions: 0, clicks: 0, positionWeighted: 0 };
    pages.set(page, { impressions: previous.impressions + impressions, clicks: previous.clicks + Math.max(0, Number(row.clicks) || 0), positionWeighted: previous.positionWeighted + impressions * (Number(row.position) || 0) });
    groups.set(query, pages);
  }
  return [...groups.entries()]
    .filter(([, pages]) => pages.size > 1)
    .map(([query, pages]) => {
      const pageItems = [...pages.entries()].map(([page, metrics]) => ({ page, ...metrics, position: metrics.impressions ? metrics.positionWeighted / metrics.impressions : null }));
      const competition = competitionScore(query, pageItems);
      const severity = competition?.score >= highThreshold ? "HIGH" : competition?.score >= 60 ? "MEDIUM" : "LOW";
      return Object.freeze({
        query,
        severity,
        score: competition?.score || 0,
        recommendedAction: severity === "HIGH" ? "MERGE" : severity === "MEDIUM" ? "REVIEW" : "MONITOR",
        intentSimilarity: competition?.intentSimilarity || 0,
        topicSimilarity: competition?.topicSimilarity || 0,
        entitySimilarity: competition?.entitySimilarity || 0,
        pages: pageItems.sort((a, b) => b.impressions - a.impressions)
      });
    })
    .sort((a, b) => b.score - a.score || b.pages[0].impressions - a.pages[0].impressions);
}
