/** Resolve GSC query/page rows into actionable SEO/GEO search intelligence. */

function normalizeUrl(value) {
  return String(value || "").replace(/#.*$/, "").replace(/\/$/, "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .trim()
    .toLowerCase();
}

function tokens(value) {
  return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length >= 2));
}

function jaccard(a, b) {
  const left = a instanceof Set ? a : tokens(a), right = b instanceof Set ? b : tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function aggregate(rows = []) {
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
      dataState: row.dataState || row.data_state || null
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
  const exact = haystack.includes(normalizedQuery) ? 1 : 0;
  const overlap = jaccard(tokens(haystack), tokens(normalizedQuery));
  return exact === 1 || overlap >= 0.25;
}

function classifySearchOpportunity(signal) {
  if (!signal?.available) return "CREATE_OR_MONITOR";
  const position = Number(signal.position);
  const ctr = Number(signal.ctr) || 0;
  if (Number.isFinite(position) && position <= 10 && ctr < 0.03) return "OPTIMIZE";
  if (Number.isFinite(position) && position > 10 && position <= 30) return "EXPAND";
  return "MONITOR";
}

export function resolveOpportunitySearchSignals(opportunities = [], index) {
  if (!index) return opportunities;
  return opportunities.map((item) => {
    const pageSignals = getCandidatePages(item).map((page) => index.byPage.get(page)).filter(Boolean);
    const querySignals = index.opportunities.filter((row) => queryMatches(item, row.query)).slice(0, 10);
    const candidates = [...pageSignals, aggregate(querySignals)];
    const best = candidates.find((signal) => signal?.available) || { available: false, impressions: 0, clicks: 0, ctr: 0, position: null };
    return Object.freeze({ ...item, searchSignal: best, searchSignalSource: best.available ? "google-search-console" : "none", searchAction: classifySearchOpportunity(best) });
  });
}

function resolveSemanticPage(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  return null;
}

function pageSimilarity(a, b) {
  const left = resolveSemanticPage(a);
  const right = resolveSemanticPage(b);
  if (!left || !right) return 0;
  const intent = left.intent && right.intent && left.intent === right.intent ? 1 : 0;
  const topicValuesLeft = left.topics || left.topic || [];
  const topicValuesRight = right.topics || right.topic || [];
  const topic = jaccard(Array.isArray(topicValuesLeft) ? topicValuesLeft.join(" ") : topicValuesLeft, Array.isArray(topicValuesRight) ? topicValuesRight.join(" ") : topicValuesRight);
  const entityLeft = left.entity || left.entityType || "";
  const entityRight = right.entity || right.entityType || "";
  const entity = entityLeft && entityRight && normalizeText(entityLeft) === normalizeText(entityRight) ? 1 : 0;
  return topic * 0.55 + intent * 0.30 + entity * 0.15;
}

function normalizeSemanticMap(pageSemantics = []) {
  if (pageSemantics instanceof Map) return pageSemantics;
  if (Array.isArray(pageSemantics)) return new Map(pageSemantics.map((item) => [normalizeUrl(item?.url || item?.canonicalUrl), item]).filter(([key]) => key));
  if (pageSemantics && typeof pageSemantics === "object") return new Map(Object.entries(pageSemantics).map(([key, value]) => [normalizeUrl(key), value]).filter(([key]) => key));
  return new Map();
}

export function detectSearchCannibalization(rows = [], { minImpressions = 50, similarityThreshold = 0.55, pageSemantics = [] } = {}) {
  const groups = new Map();
  for (const row of rows) {
    const query = normalizeText(row.query);
    const page = normalizeUrl(row.page);
    if (!query || !page || Number(row.impressions) < minImpressions) continue;
    const pages = groups.get(query) || new Map();
    pages.set(page, (pages.get(page) || 0) + Math.max(0, Number(row.impressions) || 0));
    groups.set(query, pages);
  }

  const semanticMap = normalizeSemanticMap(pageSemantics);
  return [...groups.entries()]
    .filter(([, pages]) => pages.size > 1)
    .map(([query, pages]) => {
      const ranked = [...pages.entries()].sort((a, b) => b[1] - a[1]);
      const totalImpressions = ranked.reduce((sum, [, value]) => sum + value, 0);
      const competition = ranked.map(([page, impressions], index) => ({ page, impressions, share: totalImpressions ? impressions / totalImpressions : 0, rank: index + 1 }));
      const pairScores = [];
      for (let i = 0; i < competition.length; i += 1) {
        for (let j = i + 1; j < competition.length; j += 1) {
          const left = semanticMap.get(competition[i].page);
          const right = semanticMap.get(competition[j].page);
          if (left && right) pairScores.push(pageSimilarity(left, right));
        }
      }
      const semanticSimilarity = pairScores.length ? Math.max(...pairScores) : 0;
      const hasSemanticEvidence = pairScores.length > 0;
      const dominantShare = competition[0]?.share || 0;
      const distributionSeverity = dominantShare < 0.7 ? "HIGH" : dominantShare < 0.85 ? "MEDIUM" : "LOW";
      const semanticConfirmed = !hasSemanticEvidence || semanticSimilarity >= similarityThreshold;
      const severity = semanticConfirmed ? distributionSeverity : "LOW";
      const confidenceBase = severity === "HIGH" ? 0.9 : severity === "MEDIUM" ? 0.7 : 0.45;
      const confidence = hasSemanticEvidence ? confidenceBase * semanticSimilarity : Math.min(confidenceBase, 0.5);
      return Object.freeze({ query, pages: competition, severity, confidence: Number(confidence.toFixed(3)), semanticSimilarity, semanticEvidence: hasSemanticEvidence, similarityThreshold, actionable: severity === "HIGH" && (!hasSemanticEvidence || semanticSimilarity >= similarityThreshold) });
    })
    .filter((item) => item.actionable || item.severity !== "LOW")
    .sort((a, b) => b.pages[0].impressions - a.pages[0].impressions);
}

export { normalizeText, normalizeUrl, jaccard, pageSimilarity };
