/**
 * Fast, request-safe SEO dashboard read model.
 *
 * IMPORTANT:
 * - This module intentionally does not run the full SEO decision engine.
 * - It reads already-persisted topic decisions plus compact SQL aggregates.
 * - The full decision engine remains available to scheduled/build workflows.
 * - Keeping the admin GET path read-mostly prevents CPU-heavy semantic work
 *   from running inside Cloudflare Workers request execution.
 */

import { normalizeQuery, isBrandNavigationQuery } from "../helpers/query.js";
import { slugifyArticleTitle } from "./content-strategy/slug.js";

const DEFAULT_SITE = "https://fatehmusic.ir";
const DEFAULT_TOPIC_LIMIT = 60;
const DEFAULT_GSC_QUERY_LIMIT = 100;
const DEFAULT_GSC_PAGE_LIMIT = 100;
const DEFAULT_GSC_OWNERSHIP_LIMIT = 120;
const DEFAULT_MARKET_LIMIT = 12;

function normalizeSiteUrl(value) {
  return String(value || DEFAULT_SITE).replace(/\/$/, "");
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function ageDays(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function freshnessFromAge(days, freshDays, agingDays) {
  if (days == null) return "UNKNOWN";
  if (days <= freshDays) return "FRESH";
  if (days <= agingDays) return "AGING";
  return "STALE";
}

function normalizePage(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function topicName(row) {
  return String(
    row?.related_course_title ||
    row?.instrument_key ||
    row?.category ||
    "آموزش موسیقی"
  ).trim();
}

function courseRef(row, baseUrl, coursesBySlug) {
  const slug = String(row?.related_course_slug || "").trim();
  if (!slug) return null;
  const course = coursesBySlug.get(slug);
  return {
    slug,
    title: course?.title || row?.related_course_title || slug,
    url: baseUrl + "/courses/" + slug
  };
}

function actionForTopic(row, matchedSearch) {
  if (matchedSearch?.topPage && matchedSearch.topShare >= 0.70 && matchedSearch.impressions >= 20) return "LINK";
  if (row?.source === "topic-engine" && Number(row?.score_total) >= 80) return "NEW_CONTENT";
  if (row?.modifier_type === "comparison") return "NEW_CONTENT";
  if (matchedSearch?.position != null && matchedSearch.position <= 10 && matchedSearch.ctr < 0.03) return "OPTIMIZE_EXISTING";
  return "NEW_CONTENT";
}

function buildQueryMap(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const query = normalizeQuery(row?.query);
    if (!query || isBrandNavigationQuery(query)) continue;
    const current = map.get(query) || {
      query,
      displayQuery: String(row?.query || query).trim() || query,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
      positionImpressions: 0
    };
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    const clicks = Math.max(0, Number(row?.clicks) || 0);
    const position = Number(row?.position);
    current.clicks += clicks;
    current.impressions += impressions;
    if (impressions > 0 && Number.isFinite(position) && position > 0) {
      current.weightedPosition += position * impressions;
      current.positionImpressions += impressions;
    }
    map.set(query, current);
  }
  return map;
}

function finalizeSignal(value) {
  return {
    query: value.query,
    displayQuery: value.displayQuery,
    clicks: value.clicks,
    impressions: value.impressions,
    ctr: value.impressions ? value.clicks / value.impressions : 0,
    position: value.positionImpressions ? value.weightedPosition / value.positionImpressions : null
  };
}

function buildPageMap(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const page = normalizePage(row?.page);
    if (!page) continue;
    const current = map.get(page) || {
      page,
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
      positionImpressions: 0
    };
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    const clicks = Math.max(0, Number(row?.clicks) || 0);
    const position = Number(row?.position);
    current.clicks += clicks;
    current.impressions += impressions;
    if (impressions > 0 && Number.isFinite(position) && position > 0) {
      current.weightedPosition += position * impressions;
      current.positionImpressions += impressions;
    }
    map.set(page, current);
  }
  return map;
}

function buildOwnership(pairRows = [], limit = DEFAULT_GSC_OWNERSHIP_LIMIT) {
  const byQuery = new Map();
  for (const row of pairRows) {
    const query = normalizeQuery(row?.query);
    const page = normalizePage(row?.page);
    if (!query || !page || isBrandNavigationQuery(query)) continue;
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    if (!impressions) continue;
    const pages = byQuery.get(query) || new Map();
    pages.set(page, (pages.get(page) || 0) + impressions);
    byQuery.set(query, pages);
  }

  return [...byQuery.entries()]
    .map(([query, pages]) => {
      const impressions = [...pages.values()].reduce((sum, value) => sum + value, 0);
      const ranked = [...pages.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5);
      const top = ranked[0];
      const topShare = top && impressions ? top[1] / impressions : 0;
      return {
        query,
        displayQuery: query,
        impressions,
        pageCount: pages.size,
        topPage: top?.[0] || null,
        topShare,
        ownerStatus: impressions < 20 ? "EMERGING" : topShare >= 0.70 ? "STABLE" : "SPLIT",
        pages: ranked.map(([page, pageImpressions]) => ({
          page,
          impressions: pageImpressions,
          share: impressions ? pageImpressions / impressions : 0
        }))
      };
    })
    .filter((item) => item.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query))
    .slice(0, Math.max(1, Number(limit) || DEFAULT_GSC_OWNERSHIP_LIMIT));
}

function bestQueryForTopic(row, querySignals) {
  const candidates = [
    row?.title,
    row?.related_course_title,
    row?.instrument_key,
    row?.category
  ].map(normalizeQuery).filter(Boolean);

  let best = null;
  for (const [query, signal] of querySignals.entries()) {
    const subject = normalizeQuery(row?.title);
    if (subject && (query === subject || query.includes(subject) || subject.includes(query))) {
      const finalized = finalizeSignal(signal);
      if (!best || finalized.impressions > best.impressions) best = finalized;
      continue;
    }
    const shared = candidates.some((token) => token.length >= 3 && query.includes(token));
    if (shared) {
      const finalized = finalizeSignal(signal);
      if (!best || finalized.impressions > best.impressions) best = finalized;
    }
  }
  return best;
}

function evidenceScore(topicRow, matchedSearch, marketAvailable) {
  let score = 45;
  const breakdown = [];
  if (Number(topicRow?.score_total) >= 70) {
    score += 15;
    breakdown.push("PERSISTED_TOPIC_SCORE");
  }
  if (matchedSearch?.impressions > 0) {
    score += matchedSearch.impressions >= 50 ? 20 : 10;
    breakdown.push("GSC_OBSERVED");
  }
  if (matchedSearch?.position != null && matchedSearch.position <= 10) {
    score += 10;
    breakdown.push("GSC_TOP10");
  }
  if (marketAvailable) {
    score += 10;
    breakdown.push("MARKET_OBSERVED");
  }
  return {
    score: clamp(score),
    sources: breakdown
  };
}

function queryAngles(row) {
  const topic = String(row?.related_course_title || row?.title || "این موضوع").trim();
  const intent = String(row?.intent || "informational");
  if (intent === "commercial") return [
    "بهترین دوره " + topic,
    topic + " مناسب چه کسانی است",
    "مقایسه کلاس " + topic
  ];
  if (intent === "transactional") return [
    "هزینه کلاس " + topic,
    "قیمت دوره " + topic,
    "ثبت نام " + topic
  ];
  if (row?.modifier_type === "comparison") return [
    "تفاوت " + topic,
    "مقایسه " + topic
  ];
  return [
    "چگونه " + topic + " را شروع کنیم",
    "سرفصل های " + topic,
    "اشتباهات رایج در " + topic
  ];
}

function recommendedLinks(row, baseUrl) {
  const course = String(row?.related_course_slug || "").trim();
  return [...new Set([
    course ? baseUrl + "/courses/" + course : baseUrl + "/courses",
    baseUrl + "/locations/shushtar",
    baseUrl + "/register",
    baseUrl + "/blog"
  ])];
}

/**
 * @param {{db:D1Database,siteUrl?:string,courses?:object[],topicLimit?:number,gscQueryLimit?:number,gscPageLimit?:number,gscOwnershipLimit?:number,marketLimit?:number,marketTarget?:string,marketCountry?:string}} options
 */
export async function getSeoDashboardIntelligence({
  db,
  siteUrl = DEFAULT_SITE,
  courses = [],
  topicLimit = DEFAULT_TOPIC_LIMIT,
  gscQueryLimit = DEFAULT_GSC_QUERY_LIMIT,
  gscPageLimit = DEFAULT_GSC_PAGE_LIMIT,
  gscOwnershipLimit = DEFAULT_GSC_OWNERSHIP_LIMIT,
  marketLimit = DEFAULT_MARKET_LIMIT,
  marketTarget = siteUrl,
  marketCountry = ""
} = {}) {
  const baseUrl = normalizeSiteUrl(siteUrl);
  if (!db) {
    return Object.freeze({
      mode: "READ_MODEL",
      opportunities: Object.freeze([]),
      marketOpportunities: Object.freeze([]),
      gsc: Object.freeze({ connected: false, signalRowCount: 0, queryOwnership: Object.freeze([]), index: { byQueryNonBrand: new Map(), byPageNonBrand: new Map() } }),
      summary: Object.freeze({
        opportunityCount: 0,
        highPriorityCount: 0,
        newContentCount: 0,
        searchBackedCount: 0,
        marketBackedCount: 0,
        cannibalizationCount: 0,
        evidenceStrengthAverage: 0,
        gscCoverageStatus: "EMPTY",
        queryOwnershipTruncated: false,
        queryOwnershipCount: 0,
        queryOwnershipTotalCount: 0,
        activeTopicCount: 0,
        approvedTopicCount: 0,
        candidateTopicCount: 0,
        gscSignalCount: 0,
        gscFreshness: "UNKNOWN",
        marketFreshness: "UNKNOWN"
      })
    });
  }

  const safeTopicLimit = Math.max(1, Math.min(Number(topicLimit) || DEFAULT_TOPIC_LIMIT, 120));
  const safeQueryLimit = Math.max(1, Math.min(Number(gscQueryLimit) || DEFAULT_GSC_QUERY_LIMIT, 200));
  const safePageLimit = Math.max(1, Math.min(Number(gscPageLimit) || DEFAULT_GSC_PAGE_LIMIT, 200));
  const safeOwnershipLimit = Math.max(1, Math.min(Number(gscOwnershipLimit) || DEFAULT_GSC_OWNERSHIP_LIMIT, 200));
  const safeMarketLimit = Math.max(1, Math.min(Number(marketLimit) || DEFAULT_MARKET_LIMIT, 30));

  const [topicResult, topicCountResult, gscCountResult, ownershipCountResult, queryResult, pageResult, ownershipResult, syncResult, metricsResult, competitorsResult, refdomainsResult, keywordsResult] = await Promise.all([
    db.prepare(
      "SELECT id, title, normalized_key, instrument_key, related_course_slug, related_course_title, category, audience, level, modifier_type, intent, score_total, score_breakdown, reasoning, status, source, created_at, updated_at " +
      "FROM content_topics WHERE status IN ('approved','candidate') " +
      "AND NOT (" +
      "related_course_slug IS NOT NULL " +
      "AND title LIKE '%شوشتر%' " +
      "AND EXISTS (" +
      "SELECT 1 FROM blog_posts p " +
      "WHERE p.related_course_slug = content_topics.related_course_slug " +
      "AND p.title LIKE '%شوشتر%'" +
      ")" +
      ") " +
      "ORDER BY score_total DESC, created_at DESC LIMIT ?"
    ).bind(safeTopicLimit).all(),
    db.prepare(
      "SELECT SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approvedCount, " +
      "SUM(CASE WHEN status='candidate' THEN 1 ELSE 0 END) AS candidateCount, COUNT(*) AS activeCount " +
      "FROM content_topics " +
      "WHERE status IN ('approved','candidate') " +
      "AND NOT (" +
      "related_course_slug IS NOT NULL " +
      "AND title LIKE '%شوشتر%' " +
      "AND EXISTS (" +
      "SELECT 1 FROM blog_posts p " +
      "WHERE p.related_course_slug = content_topics.related_course_slug " +
      "AND p.title LIKE '%شوشتر%'" +
      ")" +
      ")"
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS signalCount FROM gsc_search_signals_v2 WHERE snapshot_label='current' AND country='' AND device='' AND search_appearance=''"
    ).first(),
    db.prepare(
      "SELECT COUNT(DISTINCT query) AS queryCount FROM gsc_search_signals_v2 WHERE snapshot_label='current' AND country='' AND device='' AND search_appearance=''"
    ).first(),
    db.prepare(
      "SELECT query, SUM(clicks) AS clicks, SUM(impressions) AS impressions, " +
      "CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position " +
      "FROM gsc_search_signals_v2 WHERE snapshot_label='current' AND country='' AND device='' AND search_appearance='' " +
      "GROUP BY query ORDER BY impressions DESC LIMIT ?"
    ).bind(safeQueryLimit).all(),
    db.prepare(
      "SELECT page, SUM(clicks) AS clicks, SUM(impressions) AS impressions, " +
      "CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE NULL END AS position " +
      "FROM gsc_search_signals_v2 WHERE snapshot_label='current' AND country='' AND device='' AND search_appearance='' " +
      "GROUP BY page ORDER BY impressions DESC LIMIT ?"
    ).bind(safePageLimit).all(),
    db.prepare(
      "SELECT query, page, SUM(impressions) AS impressions " +
      "FROM gsc_search_signals_v2 WHERE snapshot_label='current' AND country='' AND device='' AND search_appearance='' " +
      "GROUP BY query, page ORDER BY impressions DESC LIMIT 600"
    ).all(),
    db.prepare(
      "SELECT id, site_url AS siteUrl, start_date AS startDate, end_date AS endDate, status, rows_received AS rowsReceived, rows_stored AS rowsStored, truncated, started_at AS startedAt, finished_at AS finishedAt, error_message AS errorMessage, " +
      "(SELECT MAX(s.synced_at) FROM gsc_search_signals_v2 s WHERE s.site_url = r.site_url AND s.snapshot_label = 'current') AS snapshotSyncedAt " +
      "FROM gsc_sync_runs r WHERE r.site_url = ? ORDER BY r.started_at DESC LIMIT 1"
    ).bind(baseUrl).first(),
    db.prepare(
      "SELECT snapshot_date AS snapshotDate, payload, fetched_at AS fetchedAt FROM seo_market_snapshots " +
      "WHERE source='ahrefs' AND snapshot_type='metrics' AND target = ? AND country = ? ORDER BY snapshot_date DESC LIMIT 1"
    ).bind(String(marketTarget || "").trim(), String(marketCountry || "").trim()).first(),
    db.prepare(
      "SELECT snapshot_date AS snapshotDate, payload, fetched_at AS fetchedAt FROM seo_market_snapshots " +
      "WHERE source='ahrefs' AND snapshot_type='organic-competitors' AND target = ? AND country = ? ORDER BY snapshot_date DESC LIMIT 1"
    ).bind(String(marketTarget || "").trim(), String(marketCountry || "").trim()).first(),
    db.prepare(
      "SELECT snapshot_date AS snapshotDate, payload, fetched_at AS fetchedAt FROM seo_market_snapshots " +
      "WHERE source='ahrefs' AND snapshot_type='refdomains-history' AND target = ? AND country = ? ORDER BY snapshot_date DESC LIMIT 1"
    ).bind(String(marketTarget || "").trim(), String(marketCountry || "").trim()).first(),
    db.prepare(
      "SELECT snapshot_date AS snapshotDate, payload, fetched_at AS fetchedAt FROM seo_market_snapshots " +
      "WHERE source='ahrefs' AND snapshot_type='organic-keywords' AND target = ? AND country = ? ORDER BY snapshot_date DESC LIMIT 1"
    ).bind(String(marketTarget || "").trim(), String(marketCountry || "").trim()).first(),
  ]);

  const topics = Array.isArray(topicResult.results) ? topicResult.results : [];
  const queryMap = buildQueryMap(queryResult.results || []);
  const pageMap = buildPageMap(pageResult.results || []);
  const ownership = buildOwnership(ownershipResult.results || [], safeOwnershipLimit);

  const byQueryNonBrand = new Map(
    [...queryMap.entries()]
      .map(([query, value]) => [query, finalizeSignal(value)])
      .sort((a, b) => b[1].impressions - a[1].impressions)
  );
  const byPageNonBrand = new Map(
    [...pageMap.entries()]
      .map(([page, value]) => [page, finalizeSignal({ query: page, displayQuery: page, ...value })])
      .sort((a, b) => b[1].impressions - a[1].impressions)
  );

  const coursesBySlug = new Map(
    (Array.isArray(courses) ? courses : [])
      .filter((course) => course?.slug)
      .map((course) => [String(course.slug), course])
  );

  let refdomainsPayload = [];
  let marketKeywords = [];
  let marketKeywordTotalCount = 0;
  try {
    refdomainsPayload = JSON.parse(refdomainsResult?.payload || "[]");
  } catch {
    refdomainsPayload = [];
  }
  refdomainsPayload = Array.isArray(refdomainsPayload) ? refdomainsPayload : [];
  try {
    marketKeywords = JSON.parse(keywordsResult?.payload || "[]");
  } catch {
    marketKeywords = [];
  }
  marketKeywords = Array.isArray(marketKeywords) ? marketKeywords : [];
  marketKeywordTotalCount = marketKeywords.length;
  marketKeywords = marketKeywords.slice(0, safeMarketLimit);

  const marketOpportunities = marketKeywords.map((row) => {
    const key = normalizeQuery(row?.keyword);
    const gsc = queryMap.get(key);
    const gscImpressions = gsc?.impressions || 0;
    const position = Number(row?.best_position);
    const classification =
      Number.isFinite(position) && position >= 11 && position <= 20 ? "STRIKING_DISTANCE" :
      Number.isFinite(position) && position >= 21 && position <= 50 ? "CONTENT_EXPANSION" :
      Number.isFinite(position) && position <= 10 && gscImpressions > 0 ? "CTR_OR_RANKING" :
      gscImpressions === 0 ? "MARKET_ONLY" : "MONITOR";
    return {
      keyword: String(row?.keyword || "").trim(),
      volume: Number(row?.volume || 0),
      difficulty: row?.keyword_difficulty == null ? null : Number(row.keyword_difficulty),
      bestPosition: Number.isFinite(position) ? position : null,
      classification
    };
  }).filter((item) => item.keyword);

  const opportunities = topics.map((row) => {
    const matchedSearch = bestQueryForTopic(row, queryMap);
    const searchOwner = matchedSearch
      ? ownership.find((item) => item.query === normalizeQuery(matchedSearch.query)) || null
      : null;
    const evidence = evidenceScore(row, matchedSearch, marketKeywords.length > 0);
    const course = courseRef(row, baseUrl, coursesBySlug);
    const local = row?.modifier_type === "local_shushtar" || normalizeQuery(row?.title).includes("شوشتر");
    const action = actionForTopic(row, matchedSearch);
    const title = String(row?.title || "").trim();
    return Object.freeze({
      title,
      action,
      topic: String(row?.instrument_key || "music-education"),
      topicName: topicName(row),
      searchIntent: String(row?.intent || "informational"),
      searchIntents: [String(row?.intent || "informational")],
      isLocal: local,
      scope: local ? "shushtar" : "global",
      suggestedSlug: slugifyArticleTitle(title),
      targetEntity: course
        ? { type: "Course", id: course.url + "#course", name: course.title, url: course.url }
        : { type: "Thing", id: baseUrl + "/#topic", name: topicName(row), url: baseUrl + "/courses" },
      course,
      priority: clamp(Number(row?.score_total) || 0),
      articleCount: 0,
      existingArticleSlugs: [],
      gapDetected: false,
      gapPriority: 0,
      rationale: String(row?.reasoning || "موضوع در موتور تولید محتوا ذخیره شده و آماده بررسی است."),
      queryAngles: queryAngles(row),
      recommendedLinks: recommendedLinks(row, baseUrl),
      source: String(row?.source || "topic-engine"),
      searchSignal: matchedSearch
        ? {
            available: true,
            ...matchedSearch,
            ctrBenchmark: null,
            queryIntentEvidence: null,
            matchedQueries: [matchedSearch.displayQuery],
            matchedPages: searchOwner?.pages?.map((item) => item.page) || []
          }
        : null,
      searchOwnership: searchOwner
        ? {
            ...searchOwner,
            available: true,
            matchType: "EXACT",
            ownerDominanceEvidence: searchOwner.topShare >= 0.9 ? "STRONG" : searchOwner.topShare >= 0.7 ? "MODERATE" : "WEAK"
          }
        : null,
      marketSignal: (() => {
        const normalizedTitle = normalizeQuery(title);
        const market = marketKeywords.find((candidate) => normalizeQuery(candidate?.keyword) === normalizedTitle);
        return market ? { available: true, estimatedVolume: Number(market.volume || 0), difficulty: market.keyword_difficulty == null ? null : Number(market.keyword_difficulty), source: "ahrefs", matchedKeyword: market.keyword } : null;
      })(),
      marketDataQuality: {
        freshness: freshnessFromAge(ageDays(keywordsResult?.fetchedAt), 8, 16)
      },
      evidenceStrengthScore: evidence.score,
      decisionConfidence: evidence.score,
      scoreBreakdown: {
        decisionGuard: { guarded: false, cap: 100, reasons: [] },
        evidenceSignals: evidence.sources
      }
    });
  });

  const gscAge = ageDays(syncResult?.snapshotSyncedAt || syncResult?.finishedAt || syncResult?.startedAt);
  const marketAge = ageDays(metricsResult?.fetchedAt || metricsResult?.snapshotDate);
  const gscFreshness = freshnessFromAge(gscAge, 4, 8);
  const marketFreshness = freshnessFromAge(marketAge, 8, 16);
  const gscConnected = byQueryNonBrand.size > 0 || byPageNonBrand.size > 0;

  const evidenceAverage = opportunities.length
    ? Math.round(opportunities.reduce((sum, item) => sum + Number(item.evidenceStrengthScore || 0), 0) / opportunities.length)
    : 0;

  let metricsPayload = {};
  let competitorsPayload = [];
  try { metricsPayload = JSON.parse(metricsResult?.payload || "{}") || {}; } catch {}
  try { competitorsPayload = JSON.parse(competitorsResult?.payload || "[]"); } catch {}
  if (!Array.isArray(competitorsPayload)) competitorsPayload = [];

  return Object.freeze({
    mode: "READ_MODEL",
    opportunities: Object.freeze(opportunities),
    marketOpportunities: Object.freeze(marketOpportunities),
    ahrefsMetrics: metricsPayload,
    ahrefsCompetitors: Object.freeze(competitorsPayload.slice(0, 12)),
    ahrefsRefdomainsHistory: Object.freeze(refdomainsPayload),
    ahrefsOrganicKeywords: Object.freeze({
      payload: Object.freeze(marketKeywords),
      totalCount: marketKeywordTotalCount,
      snapshotDate: keywordsResult?.snapshotDate || null,
      fetchedAt: keywordsResult?.fetchedAt || null
    }),
    latestGscSync: syncResult || null,
    gsc: Object.freeze({
      connected: gscConnected,
      signalRowCount: Number(gscCountResult?.signalCount || 0),
      index: {
        byQueryNonBrand,
        byPageNonBrand
      },
      queryOwnership: Object.freeze(ownership),
      queryOwnershipTotalCount: Number(ownershipCountResult?.queryCount || 0),
      queryOwnershipLimit: safeOwnershipLimit,
      queryOwnershipTruncated: (ownershipResult.results || []).length >= 600 || Number(ownershipCountResult?.queryCount || 0) > safeOwnershipLimit
    }),
    summary: Object.freeze({
      opportunityCount: opportunities.length,
      highPriorityCount: opportunities.filter((item) => item.priority >= 85).length,
      newContentCount: opportunities.filter((item) => item.action === "NEW_CONTENT").length,
      searchBackedCount: opportunities.filter((item) => item.searchSignal?.available).length,
      marketBackedCount: opportunities.filter((item) => item.marketSignal?.available).length,
      cannibalizationCount: 0,
      evidenceStrengthAverage: evidenceAverage,
      gscCoverageStatus: syncResult?.truncated ? "PARTIAL" : gscConnected ? "OBSERVED" : "EMPTY",
      queryOwnershipCount: ownership.length,
      queryOwnershipTotalCount: Number(ownershipCountResult?.queryCount || 0),
      queryOwnershipTruncated: (ownershipResult.results || []).length >= 600 || Number(ownershipCountResult?.queryCount || 0) > safeOwnershipLimit,
      activeTopicCount: Number(topicCountResult?.activeCount || 0),
      approvedTopicCount: Number(topicCountResult?.approvedCount || 0),
      candidateTopicCount: Number(topicCountResult?.candidateCount || 0),
      gscSignalCount: Number(gscCountResult?.signalCount || 0),
      gscFreshness,
      marketFreshness
    }),
  });
}
