import { isBrandNavigationQuery, normalizeQuery, queryTokens, querySemanticFeatureSet } from "../helpers/query.js";

const GENERIC_GAP_TOKENS = new Set([
  "آموزش", "کلاس", "دوره", "موسیقی", "در", "به", "از", "برای",
  "و", "یا", "با", "را", "این", "یک", "چه", "چگونه", "چطور",
  "فاتح", "یادگیری", "مدرس"
]);

function semanticGapFeatures(value) {
  return new Set(
    [...querySemanticFeatureSet(value)].filter((feature) => {
      if (feature.startsWith("mod:") || feature.startsWith("scope:")) return true;
      return !GENERIC_GAP_TOKENS.has(feature) && feature.length >= 2;
    })
  );
}

function semanticSimilarity(left, right) {
  const a = semanticGapFeatures(left);
  const b = semanticGapFeatures(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function scoreGap(volume, difficulty, competitorCount) {
  const normalizedVolume = Math.max(0, Number(volume) || 0);
  const normalizedDifficulty = Number(difficulty);
  let score = 0;

  if (normalizedVolume >= 1000) score += 45;
  else if (normalizedVolume >= 500) score += 36;
  else if (normalizedVolume >= 100) score += 28;
  else if (normalizedVolume >= 50) score += 20;
  else if (normalizedVolume > 0) score += 10;

  if (Number.isFinite(normalizedDifficulty)) {
    if (normalizedDifficulty <= 20) score += 25;
    else if (normalizedDifficulty <= 40) score += 18;
    else if (normalizedDifficulty <= 60) score += 10;
    else if (normalizedDifficulty <= 80) score += 4;
  }

  if (competitorCount >= 5) score += 30;
  else if (competitorCount >= 3) score += 22;
  else if (competitorCount >= 2) score += 14;
  else if (competitorCount === 1) score += 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildCompetitiveGapReport({
  competitorKeywordRows = [],
  targetKeywordRows = [],
  targetQueries = [],
  minVolume = 1,
  semanticMatchThreshold = 0.9,
  limit = 100
} = {}) {
  const targetSet = new Set(
    [...targetKeywordRows, ...targetQueries]
      .map((row) => typeof row === "string" ? row : row?.keyword || row?.query)
      .map(normalizeQuery)
      .filter(Boolean)
  );

  const targetKeywords = [...targetSet];
  const semanticallyCovered = (normalizedKeyword) => targetKeywords.some((target) =>
    semanticSimilarity(normalizedKeyword, target) >= Math.max(0.8, Number(semanticMatchThreshold) || 0.9)
  );

  const grouped = new Map();

  for (const row of Array.isArray(competitorKeywordRows) ? competitorKeywordRows : []) {
    const keyword = String(row?.keyword || "").trim();
    const normalizedKeyword = normalizeQuery(keyword);
    const volume = Math.max(
      0,
      Number(row?.volume_monthly ?? row?.volume) || 0
    );
    const difficulty = Number(row?.keyword_difficulty ?? row?.difficulty);
    const domain = String(
      row?.competitor_domain ||
      row?.competitorDomain ||
      row?.domain ||
      ""
    ).trim();

    if (
      !keyword ||
      !normalizedKeyword ||
      volume < Math.max(1, Number(minVolume) || 1) ||
      targetSet.has(normalizedKeyword) ||
      semanticallyCovered(normalizedKeyword) ||
      isBrandNavigationQuery(keyword)
    ) continue;

    const current = grouped.get(normalizedKeyword) || {
      keyword,
      normalizedKeyword,
      competitorDomains: new Set(),
      volumes: [],
      difficulties: [],
      fetchedAt: null
    };

    const previousMaxVolume = Math.max(...current.volumes, 0);
    if (domain) current.competitorDomains.add(domain);
    current.volumes.push(volume);
    if (volume > previousMaxVolume) current.keyword = keyword;
    if (Number.isFinite(difficulty)) current.difficulties.push(difficulty);
    const fetchedAt = row?.fetched_at || row?.fetchedAt || null;
    if (fetchedAt && (!current.fetchedAt || String(fetchedAt) > String(current.fetchedAt))) {
      current.fetchedAt = fetchedAt;
    }
    grouped.set(normalizedKeyword, current);
  }

  const gaps = [...grouped.values()].map((item) => {
    const volume = Math.max(...item.volumes, 0);
    const difficulty = item.difficulties.length
      ? item.difficulties.reduce((sum, value) => sum + value, 0) / item.difficulties.length
      : null;
    const competitorCount = item.competitorDomains.size;
    return Object.freeze({
      keyword: item.keyword,
      normalizedKeyword: item.normalizedKeyword,
      estimatedVolume: volume,
      difficulty: Number.isFinite(difficulty) ? Number(difficulty.toFixed(1)) : null,
      competitorCount,
      competitorDomains: Object.freeze([...item.competitorDomains].sort()),
      fetchedAt: item.fetchedAt,
      gapScore: scoreGap(volume, difficulty, competitorCount),
      source: "competitor-gap",
      coverageMode: "UNMATCHED_TARGET_SEMANTICALLY"
    });
  });

  return Object.freeze(
    gaps
      .sort((a, b) => b.gapScore - a.gapScore || b.estimatedVolume - a.estimatedVolume || a.keyword.localeCompare(b.keyword, "fa"))
      .slice(0, Math.max(1, Number(limit) || 100))
  );
}

export function buildCompetitiveGapSignalMap(gaps = []) {
  const map = new Map();
  for (const gap of Array.isArray(gaps) ? gaps : []) {
    const key = normalizeQuery(gap?.keyword);
    if (!key) continue;
    map.set(key, Object.freeze({
      available: true,
      source: "competitor-gap",
      matchedKeyword: gap.keyword,
      estimatedVolume: Number(gap.estimatedVolume) || 0,
      difficulty: Number.isFinite(Number(gap.difficulty)) ? Number(gap.difficulty) : null,
      competitorCount: Number(gap.competitorCount) || 0,
      competitorDomains: gap.competitorDomains || [],
      gapScore: Number(gap.gapScore) || 0,
      matchType: "EXACT"
    }));
  }
  return map;
}
