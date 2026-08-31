/** Resolve cached GSC query/page rows into opportunity-level search signals. */

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
      position: Number(row.position) || 0
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
  return haystack.includes(normalizedQuery) || normalizedQuery.split(/\s+/).some((token) => token.length >= 3 && haystack.includes(token));
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

export function detectSearchCannibalization(rows = [], { minImpressions = 50 } = {}) {
  const groups = new Map();
  for (const row of rows) {
    const query = normalizeText(row.query);
    const page = normalizeUrl(row.page);
    if (!query || !page || Number(row.impressions) < minImpressions) continue;
    const pages = groups.get(query) || new Map();
    pages.set(page, (pages.get(page) || 0) + Number(row.impressions));
    groups.set(query, pages);
  }
  return [...groups.entries()]
    .filter(([, pages]) => pages.size > 1)
    .map(([query, pages]) => Object.freeze({
      query,
      pages: [...pages.entries()].sort((a, b) => b[1] - a[1]).map(([page, impressions]) => ({ page, impressions }))
    }))
    .sort((a, b) => b.pages[0].impressions - a.pages[0].impressions);
}
