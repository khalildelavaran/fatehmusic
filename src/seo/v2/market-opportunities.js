/**
 * Market opportunity discovery from real third-party keyword data.
 * No keyword, volume or difficulty is invented here.
 */

import { isBrandNavigationQuery, normalizeQuery } from "../helpers/query.js";
import { resolveTopics } from "./topics.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function keywordDifficultyScore(difficulty) {
  if (!Number.isFinite(difficulty)) return 0;
  if (difficulty <= 20) return 25;
  if (difficulty <= 40) return 18;
  if (difficulty <= 60) return 10;
  if (difficulty <= 80) return 4;
  return 0;
}

function volumeScore(volume) {
  if (volume >= 1000) return 35;
  if (volume >= 500) return 30;
  if (volume >= 100) return 24;
  if (volume >= 50) return 18;
  if (volume >= 20) return 12;
  if (volume > 0) return 5;
  return 0;
}

function positionScore(position) {
  if (!Number.isFinite(position) || position <= 0) return 0;
  if (position <= 3) return 15;
  if (position <= 10) return 28;
  if (position <= 20) return 35;
  if (position <= 30) return 26;
  if (position <= 50) return 16;
  return 8;
}

function effectiveRankingPosition(ahrefsPosition, gscSignal, gscFreshness = "UNKNOWN") {
  const normalizedFreshness = String(gscFreshness || "UNKNOWN").toUpperCase();
  const gscPosition = Number(gscSignal?.position);
  const hasGscPosition = Number.isFinite(gscPosition) && gscPosition > 0;
  const hasAhrefsPosition = Number.isFinite(ahrefsPosition) && ahrefsPosition > 0;

  // GSC is the property's current first-party ranking signal. Prefer it while
  // the snapshot is fresh/aging; when GSC is stale, retain Ahrefs as the
  // market fallback unless GSC is the only available position.
  if (hasGscPosition && (!hasAhrefsPosition || normalizedFreshness !== "STALE")) {
    return gscPosition;
  }
  if (hasAhrefsPosition) return ahrefsPosition;
  return hasGscPosition ? gscPosition : null;
}

function classifyMarketOpportunity(position, gscImpressions) {
  if (Number.isFinite(position) && position >= 11 && position <= 20) return "STRIKING_DISTANCE";
  if (Number.isFinite(position) && position >= 21 && position <= 50) return "CONTENT_EXPANSION";
  if (Number.isFinite(position) && position <= 10 && Number(gscImpressions) > 0) return "CTR_OR_RANKING";
  if (!gscImpressions) return "MARKET_ONLY";
  return "MONITOR";
}

function gscExactSignal(keyword, rows = []) {
  const key = normalizeQuery(keyword);
  if (!key) return null;
  const exact = rows.filter((row) => {
    if (isBrandNavigationQuery(row?.query)) return false;
    return normalizeQuery(row?.query) === key;
  });
  if (!exact.length) return null;

  const impressions = exact.reduce((sum, row) => sum + Math.max(0, Number(row?.impressions) || 0), 0);
  const clicks = exact.reduce((sum, row) => sum + Math.max(0, Number(row?.clicks) || 0), 0);
  const weightedPosition = exact.reduce((sum, row) => {
    const position = Number(row?.position);
    const weight = Math.max(0, Number(row?.impressions) || 0);
    return Number.isFinite(position) && weight > 0 ? sum + position * weight : sum;
  }, 0);
  const bestPage = [...new Map(
    exact
      .filter((row) => row?.page)
      .map((row) => [
        String(row.page),
        Math.max(0, Number(row?.impressions) || 0)
      ])
  ).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
  return {
    impressions,
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPosition / impressions : null,
    bestPage
  };
}

function semanticTopicHint(keyword) {
  const topics = resolveTopics({
    title: keyword,
    keywords: [keyword],
    path: ""
  });

  const specific = topics.find(
    (topic) => topic.slug !== "shushtar" && topic.slug !== "music-education"
  );

  return specific?.slug || "music-education";
}
export function buildMarketSignalMap(opportunities = []) {
  const map = new Map();
  for (const item of opportunities || []) {
    const keyword = normalizeQuery(item?.keyword);
    if (!keyword) continue;
    map.set(keyword, Object.freeze({
      available: true,
      estimatedVolume: Math.max(0, Number(item?.volume) || 0),
      difficulty: Number.isFinite(Number(item?.difficulty)) ? Number(item.difficulty) : null,
      bestPosition: Number.isFinite(Number(item?.bestPosition)) && Number(item.bestPosition) > 0 ? Number(item.bestPosition) : null,
      bestPositionUrl: item?.bestPositionUrl || null,
      marketScore: Math.max(0, Number(item?.marketScore) || 0),
      classification: item?.classification || null,
      action: item?.action || null,
      intents: item?.intents || null,
      serpFeatures: item?.serpFeatures || null,
      fetchedAt: item?.fetchedAt || item?.fetched_at || null,
      dataFreshness: item?.dataFreshness || null,
      source: "ahrefs",
      matchedKeyword: item?.keyword,
      matchType: "EXACT"
    }));
  }
  return map;
}

export function buildMarketOpportunityReport({
  keywordRows = [],
  gscRows = [],
  minVolume = 1,
  limit = 50,
  gscFreshness = "UNKNOWN"
} = {}) {
  const rows = Array.isArray(keywordRows) ? keywordRows : [];
  const gsc = Array.isArray(gscRows) ? gscRows : [];

  const seen = new Set();
  const opportunities = [];

  for (const row of rows) {
    const keyword = String(row?.keyword || "").trim();
    const key = normalizeQuery(keyword);
    const volume = Math.max(0, Number(row?.volume_monthly ?? row?.volume) || 0);
    const difficulty = Number(row?.keyword_difficulty ?? row?.difficulty);
    const ahrefsPosition = Number(row?.best_position);

    if (!keyword || !key || seen.has(key) || volume < Math.max(1, Number(minVolume) || 1)) continue;
    if (isBrandNavigationQuery(keyword)) continue;

    seen.add(key);
    const gscSignal = gscExactSignal(keyword, gsc);
    const gscPosition = Number(gscSignal?.position);
    const position = effectiveRankingPosition(ahrefsPosition, gscSignal, gscFreshness);
    const classification = classifyMarketOpportunity(position, gscSignal?.impressions || 0);
    const marketScore = Math.round(clamp(
      volumeScore(volume) * 0.45 +
      keywordDifficultyScore(difficulty) * 0.25 +
      positionScore(position) * 0.30
    ));

    const action =
      classification === "STRIKING_DISTANCE"
        ? "OPTIMIZE_EXISTING"
        : classification === "CONTENT_EXPANSION" || classification === "MARKET_ONLY"
          ? "EXPAND_OR_CREATE"
          : "MONITOR";

    opportunities.push(Object.freeze({
      keyword,
      normalizedKeyword: key,
      volume,
      difficulty: Number.isFinite(difficulty) ? difficulty : null,
      bestPosition: Number.isFinite(position) && position > 0 ? position : null,
      ahrefsBestPosition: Number.isFinite(ahrefsPosition) && ahrefsPosition > 0 ? ahrefsPosition : null,
      gscBestPosition: Number.isFinite(gscPosition) && gscPosition > 0 ? gscPosition : null,
      bestPositionSource:
        Number.isFinite(gscPosition) && gscPosition > 0 && (
          !Number.isFinite(ahrefsPosition) ||
          ahrefsPosition <= 0 ||
          String(gscFreshness || "UNKNOWN").toUpperCase() !== "STALE"
        )
          ? "gsc"
          : (Number.isFinite(ahrefsPosition) && ahrefsPosition > 0 ? "ahrefs" : "gsc"),
      bestPositionUrl:
        Number.isFinite(gscPosition) && gscPosition > 0 && (
          !Number.isFinite(ahrefsPosition) ||
          ahrefsPosition <= 0 ||
          String(gscFreshness || "UNKNOWN").toUpperCase() !== "STALE"
        )
          ? (gscSignal?.bestPage || row?.best_position_url || null)
          : (row?.best_position_url || gscSignal?.bestPage || null),
      classification,
      action,
      topic: semanticTopicHint(keyword),
      gscSignal,
      marketScore,
      intents: row?.intents || null,
      serpFeatures: row?.serp_features || row?.serpFeatures || null,
      fetchedAt: row?.fetched_at || row?.fetchedAt || null,
      source: "ahrefs"
    }));
  }

  return Object.freeze(
    opportunities
      .sort((a, b) => b.marketScore - a.marketScore || b.volume - a.volume || a.keyword.localeCompare(b.keyword, "fa"))
      .slice(0, Math.max(1, Number(limit) || 50))
  );
}
