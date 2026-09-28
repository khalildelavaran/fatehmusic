/**
 * Market opportunity discovery from real third-party keyword data.
 * No keyword, volume or difficulty is invented here.
 */

import { isBrandNavigationQuery, normalizeQuery } from "../helpers/query.js";
import { semanticTokens } from "../helpers/text.js";

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
  return {
    impressions,
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPosition / impressions : null
  };
}

function semanticTopicHint(keyword) {
  const tokens = new Set(semanticTokens(keyword));
  if (tokens.has("گیتار")) return "guitar";
  if (tokens.has("پیانو")) return "piano";
  if (tokens.has("ویولن")) return "violin";
  if (tokens.has("کمانچه")) return "kamancheh";
  if (tokens.has("سنتور")) return "santur";
  if (tokens.has("سه") && tokens.has("تار")) return "setar";
  if (tokens.has("تنبک")) return "tombak";
  if (tokens.has("دف")) return "daf";
  if (tokens.has("نی")) return "ney";
  if (tokens.has("آواز") || tokens.has("خوانندگی")) return "vocal";
  if (tokens.has("سلفژ")) return "solfege";
  if (tokens.has("تئوری")) return "music-theory";
  if (tokens.has("ریتم") || tokens.has("تمپو")) return "rhythm";
  if (tokens.has("شوشتر")) return "music-education";
  return "music-education";
}

export function buildMarketOpportunityReport({
  keywordRows = [],
  gscRows = [],
  minVolume = 1,
  limit = 50
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
    const position = Number(row?.best_position);

    if (!keyword || !key || seen.has(key) || volume < Math.max(1, Number(minVolume) || 1)) continue;
    if (isBrandNavigationQuery(keyword)) continue;

    seen.add(key);
    const gscSignal = gscExactSignal(keyword, gsc);
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
      bestPositionUrl: row?.best_position_url || null,
      classification,
      action,
      topic: semanticTopicHint(keyword),
      gscSignal,
      marketScore,
      source: "ahrefs"
    }));
  }

  return Object.freeze(
    opportunities
      .sort((a, b) => b.marketScore - a.marketScore || b.volume - a.volume || a.keyword.localeCompare(b.keyword, "fa"))
      .slice(0, Math.max(1, Number(limit) || 50))
  );
}
