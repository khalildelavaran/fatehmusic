/** Resolve GSC query/page rows into actionable SEO/GEO search intelligence. */

import { isBrandNavigationQuery, isOwnershipEligibleQuery, normalizeQuery, queryTokens } from "../helpers/query.js";
import { normalizeUrl } from "../helpers/url.js";
import { resolveTopics } from "./topics.js";
import { classifyIntent } from "./intents.js";

function normalizeText(value) { return normalizeQuery(value); }

const tokens = queryTokens;


function wilsonInterval(successes, trials, z = 1.96) {
  const n = Math.max(0, Number(trials) || 0);
  const x = Math.min(n, Math.max(0, Number(successes) || 0));
  if (n <= 0) return null;

  const p = x / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const halfWidth = z * Math.sqrt((p * (1 - p) / n) + (z2 / (4 * n * n))) / denominator;

  return Object.freeze({
    lower: Number(Math.max(0, center - halfWidth).toFixed(4)),
    upper: Number(Math.min(1, center + halfWidth).toFixed(4))
  });
}

function querySignalQuality(impressions) {
  if (impressions >= 100) return "HIGH";
  if (impressions >= 20) return "MEDIUM";
  if (impressions >= 5) return "LOW";
  return "TRACE";
}

function jaccard(a, b) {
  const left = a instanceof Set ? a : tokens(a), right = b instanceof Set ? b : tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function positionBucket(position) {
  const value = Number(position);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value <= 3) return "TOP_3";
  if (value <= 10) return "TOP_10";
  if (value <= 20) return "TOP_20";
  if (value <= 50) return "TOP_50";
  return "BEYOND_50";
}

function buildCtrBenchmarks(rows = []) {
  const buckets = new Map();
  for (const row of rows) {
    const bucket = positionBucket(row?.position);
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    const clicks = Math.max(0, Number(row?.clicks) || 0);
    if (!bucket || impressions <= 0) continue;
    const current = buckets.get(bucket) || { clicks: 0, impressions: 0 };
    current.clicks += clicks;
    current.impressions += impressions;
    buckets.set(bucket, current);
  }
  return Object.freeze(
    Object.fromEntries(
      [...buckets.entries()].map(([bucket, value]) => [
        bucket,
        {
          ctr: value.impressions > 0 ? value.clicks / value.impressions : null,
          impressions: value.impressions,
          clicks: value.clicks
        }
      ])
    )
  );
}

function aggregate(rows = [], ctrBenchmarks = {}) {
  const groupBucketTotals = new Map();
  for (const row of rows) {
    const bucket = positionBucket(row?.position);
    if (!bucket) continue;
    const current = groupBucketTotals.get(bucket) || { clicks: 0, impressions: 0 };
    current.clicks += Math.max(0, Number(row?.clicks) || 0);
    current.impressions += Math.max(0, Number(row?.impressions) || 0);
    groupBucketTotals.set(bucket, current);
  }

  const externalBenchmark = (bucket) => {
    const totalBucket = ctrBenchmarks[bucket];
    const ownBucket = groupBucketTotals.get(bucket);
    if (!totalBucket || !ownBucket) return null;
    const impressions = Math.max(0, Number(totalBucket.impressions || 0) - ownBucket.impressions);
    const clicks = Math.max(0, Number(totalBucket.clicks || 0) - ownBucket.clicks);
    return impressions >= 50 ? {
      ctr: clicks / impressions,
      impressions
    } : null;
  };

  const total = rows.reduce((acc, row) => {
    const impressions = Math.max(0, Number(row.impressions) || 0);
    const clicks = Math.max(0, Number(row.clicks) || 0);
    const position = Number(row.position);
    if (impressions > 0 && Number.isFinite(position) && position > 0) {
      acc.weightedPosition += impressions * position;
      acc.positionImpressions += impressions;
    }
    acc.clicks += clicks;
    acc.impressions += impressions;
    return acc;
  }, { clicks: 0, impressions: 0, weightedPosition: 0, positionImpressions: 0 });
  const ctr = total.impressions ? total.clicks / total.impressions : 0;
  const benchmarkWeight = rows.reduce((sum, row) => {
    const benchmark = externalBenchmark(positionBucket(row?.position));
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    return benchmark && impressions > 0 ? sum + impressions : sum;
  }, 0);
  const benchmarkBuckets = new Set(
    rows.map((row) => positionBucket(row?.position)).filter(Boolean)
  );
  const benchmarkSampleImpressions = [...benchmarkBuckets]
    .reduce((sum, bucket) => sum + Math.max(0, Number(externalBenchmark(bucket)?.impressions) || 0), 0);
  const weightedBenchmark = benchmarkWeight > 0
    ? rows.reduce((sum, row) => {
        const benchmark = externalBenchmark(positionBucket(row?.position))?.ctr;
        const impressions = Math.max(0, Number(row?.impressions) || 0);
        return Number.isFinite(benchmark) && impressions > 0 ? sum + benchmark * impressions : sum;
      }, 0) / benchmarkWeight
    : null;
  const ctrGap = weightedBenchmark == null ? null : weightedBenchmark - ctr;
  const ctrRatioToBenchmark = weightedBenchmark > 0 ? ctr / weightedBenchmark : null;

  return {
    available: total.impressions > 0 || total.clicks > 0,
    impressions: total.impressions,
    clicks: total.clicks,
    ctr,
    ctrBenchmark: weightedBenchmark,
    ctrBenchmarkImpressions: benchmarkSampleImpressions,
    ctrBenchmarkCoverageImpressions: benchmarkWeight,
    ctrGap,
    ctrRatioToBenchmark,
    position: total.positionImpressions ? total.weightedPosition / total.positionImpressions : null,
    matchedQueries: [...new Set(rows.map((row) => String(row?.query || "").trim()).filter(Boolean))].slice(0, 10),
    matchedPages: [...new Set(rows.map((row) => normalizeUrl(row?.page)).filter(Boolean))].slice(0, 10),
    ctrInterval95: wilsonInterval(total.clicks, total.impressions),
    source: "google-search-console"
  };
}

function scoreRow(row, ctrBenchmarks = {}, benchmarkRows = []) {
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

  const bucket = positionBucket(position);
  const totalBucket = ctrBenchmarks[bucket];
  let benchmark = totalBucket?.ctr;
  if (totalBucket && Array.isArray(benchmarkRows)) {
    const externalImpressions = Math.max(0, Number(totalBucket.impressions || 0) - impressions);
    const externalClicks = Math.max(0, Number(totalBucket.clicks || 0) - clicks);
    benchmark = externalImpressions >= 50 ? externalClicks / externalImpressions : null;
  }
  if (Number.isFinite(benchmark) && benchmark > 0) {
    const gap = benchmark - ctr;
    const ratio = ctr / benchmark;

    // Reward genuine underperformance relative to peers at the same
    // ranking range instead of applying one raw CTR threshold to all ranks.
    if (gap >= 0.03 || ratio <= 0.55) score += 20;
    else if (gap >= 0.015 || ratio <= 0.75) score += 10;
  } else if (ctr < 0.03) {
    // Conservative fallback when the page has no usable peer benchmark.
    score += 20;
  } else if (ctr < 0.06) {
    score += 10;
  }

  return Math.min(100, score);
}

export function buildGscSignalIndex(rows = []) {
  const pageRows = new Map();
  const nonBrandPageRows = new Map();
  const queryRows = new Map();
  const nonBrandQueryRows = new Map();
  const queryTokenRows = new Map();
  const rawOpportunityItems = [];
  const nonBrandItems = [];
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
    if (query) {
      queryRows.set(query, [...(queryRows.get(query) || []), item]);
      const tokenized = tokens(query);
      if (isBrandNavigationQuery(query)) continue;
      nonBrandQueryRows.set(query, [...(nonBrandQueryRows.get(query) || []), item]);
      if (page) nonBrandPageRows.set(page, [...(nonBrandPageRows.get(page) || []), item]);
      nonBrandItems.push(item);
      for (const token of tokenized) {
        const bucket = queryTokenRows.get(token) || [];
        bucket.push(item);
        queryTokenRows.set(token, bucket);
      }
    }
    rawOpportunityItems.push(item);
  }
  const ctrBenchmarks = buildCtrBenchmarks(nonBrandItems);
  const opportunities = rawOpportunityItems
    .map((item) => Object.freeze({
      ...item,
      brandNavigation: isBrandNavigationQuery(item.query),
      opportunitySignalScore: scoreRow(item, ctrBenchmarks, nonBrandItems)
    }))
    .sort((a, b) => b.opportunitySignalScore - a.opportunitySignalScore);
  const semanticQueryClustersResult = buildSemanticQueryClustersWithMeta(rows, { minImpressions: 1, limit: 5000 });
  const semanticQueryClusters = semanticQueryClustersResult.items;
  const queryClusterByQuery = new Map();
  for (const cluster of semanticQueryClusters) {
    for (const query of cluster.queries) {
      queryClusterByQuery.set(query.query, cluster);
    }
  }

  return Object.freeze({
    ctrBenchmarks,
    byPage: new Map([...pageRows].map(([key, values]) => [key, aggregate(values, ctrBenchmarks)])),
    byPageNonBrand: new Map([...nonBrandPageRows].map(([key, values]) => [key, aggregate(values, ctrBenchmarks)])),
    byQuery: new Map([...queryRows].map(([key, values]) => [key, aggregate(values, ctrBenchmarks)])),
    byQueryNonBrand: new Map([...nonBrandQueryRows].map(([key, values]) => [key, aggregate(values, ctrBenchmarks)])),
    queryTokenRows: new Map([...queryTokenRows].map(([key, values]) => [key, Object.freeze(values)])),
    queryClusters: semanticQueryClusters,
    queryClusterTotalCount: semanticQueryClustersResult.totalCount,
    queryClusterLimit: semanticQueryClustersResult.limit,
    queryClusterTruncated: semanticQueryClustersResult.truncated,
    queryClusterByQuery: Object.freeze(queryClusterByQuery),
    opportunities: Object.freeze(opportunities.sort((a, b) => b.opportunitySignalScore - a.opportunitySignalScore))
  });
}

function getCandidatePages(item) {
  return [item.url, item.targetEntity?.url].filter(Boolean).map(normalizeUrl);
}

function queryCoverage(haystack, normalizedQuery) {
  const targetTokens = tokens(haystack);
  const queryTokenSet = tokens(normalizedQuery);
  if (!targetTokens.size || !queryTokenSet.size) {
    return { exact: 0, queryCoverage: 0, targetCoverage: 0, overlap: 0 };
  }

  let shared = 0;
  for (const token of queryTokenSet) {
    if (targetTokens.has(token)) shared += 1;
  }

  return {
    exact: phraseIncludes(haystack, normalizedQuery) ? 1 : 0,
    queryCoverage: shared / queryTokenSet.size,
    targetCoverage: shared / targetTokens.size,
    overlap: shared / new Set([...targetTokens, ...queryTokenSet]).size
  };
}

function candidateSemanticText(item = {}) {
  return [
    item?.title,
    item?.topicName,
    item?.topic,
    item?.course?.title,
    ...(item?.queryAngles || []),
    ...(item?.marketQueryAngles || [])
  ].filter(Boolean).join(" | ");
}

function candidatePrimaryTopic(item = {}) {
  return normalizeText(item?.topicName || "");
}

function queryHasCompetingSpecificTopics(query, candidateTopic = "") {
  const specificTopics = resolveTopics({
    title: query,
    keywords: [query],
    path: ""
  })
    .filter((topic) => topic.slug !== "music-education" && topic.slug !== "shushtar");

  if (!specificTopics.length) return false;
  if (!candidateTopic) return specificTopics.length > 1;
  return specificTopics.length > 1 &&
    !specificTopics.some((topic) => normalizeText(topic.name) === candidateTopic);
}

function queryTopicAlignment(item, query) {
  const candidateTopic = candidatePrimaryTopic(item);
  if (!candidateTopic) return false;
  const normalizedQuery = normalizeText(query);
  return containsSemanticPhrase(normalizedQuery, candidateTopic) &&
    !queryHasCompetingSpecificTopics(normalizedQuery, candidateTopic);
}

function queryMatches(item, query) {
  const haystack = normalizeText(candidateSemanticText(item));
  const normalizedQuery = normalizeText(query);
  if (!haystack || !normalizedQuery) return false;

  const coverage = queryCoverage(haystack, normalizedQuery);
  if (coverage.exact === 1) return true;

  const queryTokenCount = tokens(normalizedQuery).size;
  if (queryTokenCount === 1) return coverage.queryCoverage === 1;

  const strictMatch = coverage.queryCoverage >= 0.67 &&
    coverage.targetCoverage >= 0.34 &&
    coverage.overlap >= 0.34;
  if (strictMatch) return true;

  // Allow intent modifiers that sit around the candidate's subject core,
  // but only for short queries and only when no competing subject/topic is
  // present. This preserves precision while catching queries like
  // «هزینه کلاس گیتار» for a guitar opportunity.
  if (
    queryTokenCount <= 3 &&
    coverage.queryCoverage >= (queryTokenCount === 2 ? 0.50 : 0.34) &&
    coverage.overlap >= 0.25 &&
    queryTopicAlignment(item, normalizedQuery)
  ) {
    return true;
  }

  return false;
}

function queryRelevanceScore(item, query) {
  const haystack = normalizeText(candidateSemanticText(item));
  const normalizedQuery = normalizeText(query);
  if (!haystack || !normalizedQuery) return 0;

  const coverage = queryCoverage(haystack, normalizedQuery);
  const exact = coverage.exact;
  const overlap = coverage.overlap;
  let score = exact * 100 + overlap * 50 +
    coverage.queryCoverage * 35 +
    coverage.targetCoverage * 15;

  if (queryTopicAlignment(item, normalizedQuery)) score += 18;

  const targetIntent = String(item?.searchIntent || item?.intent || "").trim().toLowerCase();
  if (targetIntent) {
    const queryIntent = classifyIntent({ title: query, keywords: [query] }).primary;
    if (queryIntent === targetIntent) score += 20;
    else if (
      (targetIntent === "commercial" && queryIntent === "transactional") ||
      (targetIntent === "transactional" && queryIntent === "commercial")
    ) {
      score += 8;
    } else if (queryIntent && queryIntent !== "informational" && targetIntent === "informational") {
      score -= 6;
    }
  }

  return score;
}

function buildGscQueryIntentEvidence(rows = [], opportunity = {}) {
  const byQuery = new Map();
  for (const row of rows) {
    const query = normalizeText(row?.query);
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    if (!query || impressions <= 0) continue;
    const current = byQuery.get(query) || { query, impressions: 0 };
    current.impressions += impressions;
    byQuery.set(query, current);
  }

  const distribution = new Map();
  let totalImpressions = 0;
  const queryEvidence = [];

  for (const item of byQuery.values()) {
    const result = classifyIntent({ title: item.query });
    const primary = result.primary;
    const relevance = Math.max(0, Math.min(1, queryRelevanceScore(opportunity, item.query) / 100));
    if (relevance < 0.34) continue;
    const weight = item.impressions * relevance;
    distribution.set(primary, (distribution.get(primary) || 0) + weight);
    totalImpressions += weight;
    queryEvidence.push({
      query: item.query,
      impressions: item.impressions,
      weightedImpressions: Number(weight.toFixed(2)),
      relevance: Number(relevance.toFixed(3)),
      primary,
      confidence: result.confidence
    });
  }

  if (!totalImpressions) return null;

  const ranked = [...distribution.entries()]
    .map(([intent, impressions]) => ({
      intent,
      impressions,
      share: impressions / totalImpressions
    }))
    .sort((a, b) => b.impressions - a.impressions || a.intent.localeCompare(b.intent));

  const top = ranked[0] || null;
  const second = ranked[1] || null;
  const margin = top && second ? top.share - second.share : top?.share || 0;

  return Object.freeze({
    primary: top?.intent || null,
    primaryShare: top ? Number(top.share.toFixed(3)) : 0,
    margin: Number(margin.toFixed(3)),
    confidence: Number(Math.min(0.99, Math.max(0.35, (top?.share || 0) + margin * 0.5)).toFixed(3)),
    sampleImpressions: Number(totalImpressions.toFixed(2)),
    rawSampleImpressions: queryEvidence.reduce((sum, item) => sum + item.impressions, 0),
    queryCount: queryEvidence.length,
    distribution: Object.freeze(Object.fromEntries(
      ranked.map((item) => [item.intent, Number(item.share.toFixed(3))])
    )),
    queries: Object.freeze(
      queryEvidence
        .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query))
        .slice(0, 12)
    )
  });
}

function relevantQueryRows(index, item) {
  const haystack = normalizeText([item.title, item.topicName, item.topic, item.course?.title].filter(Boolean).join(" | "));
  const candidateTokens = tokens(haystack);
  if (!candidateTokens.size || !index.queryTokenRows) return [];
  const seen = new Set();
  const rows = [];
  for (const token of candidateTokens) {
    for (const row of index.queryTokenRows.get(token) || []) {
      const key = [
        normalizeText(row.query),
        normalizeUrl(row.page),
        String(row.startDate || row.start_date || ""),
        String(row.endDate || row.end_date || "")
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

function isExactQueryMatch(item, query) {
  const haystack = normalizeText([
    item?.title,
    item?.topicName,
    item?.topic,
    item?.course?.title
  ].filter(Boolean).join(" | "));
  const normalizedQuery = normalizeText(query);
  return Boolean(haystack && normalizedQuery && phraseIncludes(haystack, normalizedQuery));
}

function buildQueryOwnership(querySignals = [], item = {}) {
  const eligible = querySignals.filter((row) => {
    const query = String(row?.query || "");
    return isOwnershipEligibleQuery(query) && Number(row?.impressions || 0) > 0;
  });
  const exactEligible = eligible.filter((row) => isExactQueryMatch(item, row?.query));

  if (!exactEligible.length) {
    return Object.freeze({
      available: false,
      matchType: "RELATED",
      impressions: 0,
      relatedImpressions: eligible.reduce((sum, row) => sum + Math.max(0, Number(row?.impressions) || 0), 0),
      matchedQueries: [],
      relatedQueries: [...new Set(eligible.map((row) => String(row?.query || "").trim()).filter(Boolean))].slice(0, 10),
      pages: [],
      topPage: null,
      topShare: 0,
      source: "google-search-console"
    });
  }

  const pageImpressions = new Map();
  for (const row of exactEligible) {
    const page = normalizeUrl(row?.page);
    if (!page) continue;
    pageImpressions.set(
      page,
      (pageImpressions.get(page) || 0) + Math.max(0, Number(row?.impressions) || 0)
    );
  }

  const totalImpressions = exactEligible.reduce(
    (sum, row) => sum + Math.max(0, Number(row?.impressions) || 0),
    0
  );
  const totalClicks = exactEligible.reduce(
    (sum, row) => sum + Math.max(0, Number(row?.clicks) || 0),
    0
  );
  const weightedPosition = exactEligible.reduce((sum, row) => {
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    const position = Number(row?.position);
    return Number.isFinite(position) && impressions > 0 ? sum + position * impressions : sum;
  }, 0);
  const pages = [...pageImpressions.entries()]
    .map(([page, impressions]) => ({
      page,
      impressions,
      share: totalImpressions ? impressions / totalImpressions : 0,
      shareInterval95: wilsonInterval(impressions, totalImpressions)
    }))
    .sort((a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page))
    .slice(0, 5);

  return Object.freeze({
    available: pages.length > 0,
    matchType: "EXACT",
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: totalImpressions ? totalClicks / totalImpressions : 0,
    position: totalImpressions ? weightedPosition / totalImpressions : null,
    relatedImpressions: eligible.reduce((sum, row) => sum + Math.max(0, Number(row?.impressions) || 0), 0),
    matchedQueries: [...new Set(exactEligible.map((row) => String(row?.query || "").trim()).filter(Boolean))].slice(0, 10),
    relatedQueries: [...new Set(eligible.map((row) => String(row?.query || "").trim()).filter(Boolean))].slice(0, 10),
    pages,
    topPage: pages[0]?.page || null,
    topShare: pages[0]?.share || 0,
    ownerStatus: !pages.length
      ? "NO_OWNER"
      : totalImpressions < 20
        ? "EMERGING"
        : (pages[0]?.share || 0) >= 0.7
          ? "STABLE"
          : "SPLIT",
    ownerShareInterval95: pages[0]?.shareInterval95 || null,
    ownerShareLower95: pages[0]?.shareInterval95?.lower ?? null,
    ownerDominanceEvidence:
      pages[0]?.shareInterval95?.lower >= 0.5 ? "STRONG" :
      pages[0]?.shareInterval95?.lower >= 0.35 ? "MODERATE" :
      "WEAK",
    signalQuality: querySignalQuality(totalImpressions),
    source: "google-search-console"
  });
}

export function buildQueryOwnershipMapWithMeta(rows = [], { minImpressions = 1, limit = 500 } = {}) {
  const queryPages = new Map();
  const queryStats = new Map();
  const displayQueries = new Map();

  for (const row of rows) {
    const query = normalizeText(row?.query);
    const rawQuery = String(row?.query || "").trim();
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    const page = normalizeUrl(row?.page);
    if (!query || !page || impressions <= 0 || isBrandNavigationQuery(query)) continue;
    if (!isOwnershipEligibleQuery(query)) continue;

    const pages = queryPages.get(query) || new Map();
    pages.set(page, (pages.get(page) || 0) + impressions);
    queryPages.set(query, pages);

    const stats = queryStats.get(query) || { clicks: 0, impressions: 0, weightedPosition: 0 };
    stats.clicks += Math.max(0, Number(row?.clicks) || 0);
    stats.impressions += impressions;
    const position = Number(row?.position);
    if (Number.isFinite(position) && impressions > 0) stats.weightedPosition += position * impressions;
    queryStats.set(query, stats);

    const display = displayQueries.get(query);
    if (!display || impressions > display.impressions) {
      displayQueries.set(query, { value: rawQuery || query, impressions });
    }
  }

  const eligibleQueries = [...queryPages.entries()]
    .map(([query, pages]) => {
      const aggregatedImpressions = [...pages.values()].reduce((sum, value) => sum + value, 0);
      if (aggregatedImpressions < Math.max(1, Number(minImpressions) || 1)) return null;

      const totalImpressions = aggregatedImpressions;
      const rankedPages = [...pages.entries()]
        .map(([page, impressions]) => ({
          page,
          impressions,
          share: totalImpressions ? impressions / totalImpressions : 0,
          shareInterval95: wilsonInterval(impressions, totalImpressions)
        }))
        .sort((a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page))
        .slice(0, 5);

      return Object.freeze({
        query,
        displayQuery: displayQueries.get(query)?.value || query,
        impressions: totalImpressions,
        clicks: queryStats.get(query)?.clicks || 0,
        ctr: totalImpressions ? (queryStats.get(query)?.clicks || 0) / totalImpressions : 0,
        position: queryStats.get(query)?.impressions
          ? queryStats.get(query).weightedPosition / queryStats.get(query).impressions
          : null,
        pageCount: pages.size,
        topPage: rankedPages[0]?.page || null,
        topShare: rankedPages[0]?.share || 0,
        ownerStatus: !rankedPages.length
          ? "NO_OWNER"
          : totalImpressions < 20
            ? "EMERGING"
            : (rankedPages[0]?.share || 0) >= 0.7
              ? "STABLE"
              : "SPLIT",
        ownerShareInterval95: rankedPages[0]?.shareInterval95 || null,
        ownerShareLower95: rankedPages[0]?.shareInterval95?.lower ?? null,
        ownerDominanceEvidence:
          rankedPages[0]?.shareInterval95?.lower >= 0.5 ? "STRONG" :
          rankedPages[0]?.shareInterval95?.lower >= 0.35 ? "MODERATE" :
          "WEAK",
        signalQuality: querySignalQuality(totalImpressions),
        pages: Object.freeze(rankedPages)
      });
    })
    .filter(Boolean)
    .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query));

  const safeLimit = Math.max(1, Number(limit) || 500);
  const items = eligibleQueries.slice(0, safeLimit);

  return Object.freeze({
    items: Object.freeze(items),
    totalCount: eligibleQueries.length,
    limit: safeLimit,
    truncated: eligibleQueries.length > safeLimit
  });
}

export function buildQueryOwnershipMap(rows = [], options = {}) {
  return buildQueryOwnershipMapWithMeta(rows, options).items;
}

function buildQuerySemanticProfile(query, cache = null) {
  const normalized = normalizeText(query);
  if (cache?.has(normalized)) return cache.get(normalized);

  const topics = resolveTopics({
    title: query,
    keywords: [query],
    path: ""
  });
  const topicSlugs = topics
    .map((topic) => topic.slug)
    .filter((slug) => slug !== "music-education" && slug !== "shushtar")
    .sort();
  const hasLocalScope = topics.some((topic) => topic.slug === "shushtar");
  const intent = classifyIntent({ title: query }).primary || "informational";
  const scope = hasLocalScope ? "local" : "global";
  const subject = topicSlugs.length
    ? topicSlugs.join("+")
    : [...queryTokens(query)].sort().join("+");

  const profile = Object.freeze({
    key: ["scope:" + scope, "intent:" + intent, "subject:" + subject].join("|"),
    scope,
    intent,
    subjects: Object.freeze(topicSlugs)
  });
  cache?.set(normalized, profile);
  return profile;
}

function queryClusterKey(query, cache = null) {
  return buildQuerySemanticProfile(query, cache).key;
}

export function buildSemanticQueryClustersWithMeta(rows = [], { minImpressions = 1, limit = 50 } = {}) {
  const clusters = new Map();
  const displayQueries = new Map();
  const semanticProfileCache = new Map();

  for (const row of rows) {
    const query = normalizeText(row?.query);
    const page = normalizeUrl(row?.page);
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    if (!query || !page || impressions <= 0 || !isOwnershipEligibleQuery(query)) continue;

    const profile = buildQuerySemanticProfile(query, semanticProfileCache);
    const key = profile.key;
    if (!key) continue;

    const cluster = clusters.get(key) || {
      key,
      queries: new Map(),
      pages: new Map(),
      scope: profile.scope,
      intent: profile.intent,
      subjects: profile.subjects
    };

    cluster.queries.set(query, (cluster.queries.get(query) || 0) + impressions);
    cluster.pages.set(page, (cluster.pages.get(page) || 0) + impressions);
    clusters.set(key, cluster);

    const display = displayQueries.get(query);
    const raw = String(row?.query || "").trim();
    if (!display || impressions > display.impressions) {
      displayQueries.set(query, { value: raw || query, impressions });
    }
  }

  const result = [];
  for (const [key, cluster] of clusters.entries()) {
    const impressions = [...cluster.queries.values()].reduce((sum, value) => sum + value, 0);
    if (impressions < Math.max(1, Number(minImpressions) || 1)) continue;

    const queries = [...cluster.queries.entries()]
      .map(([normalizedQuery, queryImpressions]) => ({
        query: normalizedQuery,
        displayQuery: displayQueries.get(normalizedQuery)?.value || normalizedQuery,
        impressions: queryImpressions
      }))
      .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query, "fa"))
      .slice(0, 12);

    const pages = [...cluster.pages.entries()]
      .map(([page, pageImpressions]) => ({
        page,
        impressions: pageImpressions,
        share: impressions ? pageImpressions / impressions : 0,
        shareInterval95: wilsonInterval(pageImpressions, impressions)
      }))
      .sort((a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page))
      .slice(0, 8);

    const topOwner = pages[0] || null;
    const ownerShareLower95 = topOwner?.shareInterval95?.lower ?? null;
    const ownerDominanceEvidence =
      ownerShareLower95 >= 0.5 ? "STRONG" :
      ownerShareLower95 >= 0.35 ? "MODERATE" :
      "WEAK";

    result.push(Object.freeze({
      key,
      queries: Object.freeze(queries),
      queryCount: cluster.queries.size,
      scope: cluster.scope,
      intent: cluster.intent,
      subjects: Object.freeze(cluster.subjects),
      impressions,
      pageCount: cluster.pages.size,
      topPage: topOwner?.page || null,
      topShare: topOwner?.share || 0,
      ownerStatus: !pages.length
        ? "NO_OWNER"
        : impressions < 20
          ? "EMERGING"
          : (topOwner?.share || 0) >= 0.7
            ? "STABLE"
            : "SPLIT",
      ownerShareInterval95: topOwner?.shareInterval95 || null,
      ownerShareLower95,
      ownerDominanceEvidence,
      signalQuality: querySignalQuality(impressions),
      pages: Object.freeze(pages)
    }));
  }

  const safeLimit = Math.max(1, Number(limit) || 50);
  const items = result
    .sort((a, b) => b.impressions - a.impressions || a.key.localeCompare(b.key))
    .slice(0, safeLimit);

  return Object.freeze({
    items: Object.freeze(items),
    totalCount: result.length,
    limit: safeLimit,
    truncated: result.length > safeLimit
  });
}

export function buildSemanticQueryClusters(rows = [], options = {}) {
  return buildSemanticQueryClustersWithMeta(rows, options).items;
}

function classifySearchOpportunity(signal) {
  if (!signal?.available) return "CREATE_OR_MONITOR";
  const position = Number(signal.position);
  const ctr = Math.min(1, Math.max(0, Number(signal.ctr) || 0));
  if (Number.isFinite(position) && position > 0 && position <= 10 && ctr < 0.03) return "OPTIMIZE";
  if (Number.isFinite(position) && position > 10 && position <= 30) return "EXPAND";
  return "MONITOR";
}

export function resolveOpportunitySearchSignals(opportunities = [], index) {
  if (!index) return opportunities;
  return opportunities.map((item) => {
    const pageSignals = item.action === "NEW_CONTENT"
      ? []
      : getCandidatePages(item).map((page) => index.byPageNonBrand?.get(page)).filter(Boolean);
    const matchedQueryRows = relevantQueryRows(index, item)
      .filter((row) => !isBrandNavigationQuery(row.query))
      .filter((row) => queryMatches(item, row.query));

    // Keep the dashboard signal compact, but never truncate the evidence set
    // used for exact query ownership. The owner calculation must see every
    // page that contributed impressions for the matching query.
    const querySignals = matchedQueryRows
      .slice()
      .sort((a, b) => {
        const relevanceDelta = queryRelevanceScore(item, b?.query) - queryRelevanceScore(item, a?.query);
        if (relevanceDelta !== 0) return relevanceDelta;
        return Number(b.impressions || 0) - Number(a.impressions || 0);
      })
      .slice(0, 20);
    const relevantQuerySignal = aggregate(querySignals, index.ctrBenchmarks || {});
    const queryIntentEvidence = buildGscQueryIntentEvidence(matchedQueryRows, item);
    if (queryIntentEvidence) {
      relevantQuerySignal.queryIntentEvidence = queryIntentEvidence;
    }
    const ownership = buildQueryOwnership(matchedQueryRows, item);
    const semanticQueryClusters = index.queryClusterByQuery
      ? [...new Map(
          matchedQueryRows
            .map((row) => index.queryClusterByQuery.get(normalizeText(row?.query)))
            .filter(Boolean)
            .map((cluster) => [cluster.key, cluster])
        ).values()]
      : [];
    const semanticQueryCluster = semanticQueryClusters
      .sort((a, b) => b.impressions - a.impressions || b.topShare - a.topShare || a.key.localeCompare(b.key))[0] || null;
    const candidates = [relevantQuerySignal, ...pageSignals];
    const best = candidates.find((signal) => signal?.available) || {
      available: false,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      position: null,
      matchedQueries: [],
      matchedPages: []
    };
    const ownerPage = ownership.topPage;
    const recommendedLinks = ownerPage && item.action === "LINK"
      ? [ownerPage, ...(item.recommendedLinks || []).filter((url) => normalizeUrl(url) !== ownerPage)]
      : item.recommendedLinks;

    return Object.freeze({
      ...item,
      ...(recommendedLinks ? { recommendedLinks: Object.freeze(recommendedLinks.slice(0, 8)) } : {}),
      searchSignal: best,
      searchOwnership: ownership,
      semanticQueryCluster,
      searchSignalSource: best.available ? "google-search-console" : "none",
      searchAction: classifySearchOpportunity(best)
    });
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
  // Compare pages that rank for the same query within the same GSC
  // reporting window. A page switching ownership between windows is a
  // temporal transition, not simultaneous cannibalization.
  const groups = new Map();
  for (const row of rows) {
    const query = normalizeText(row.query);
    const page = normalizeUrl(row.page);
    const startDate = String(row.startDate || row.start_date || "").trim();
    const endDate = String(row.endDate || row.end_date || "").trim();
    if (!query || !page || !isOwnershipEligibleQuery(query) || Number(row.impressions) < minImpressions) continue;
    const period = startDate || endDate ? `${startDate}|${endDate}` : "undated";
    const groupKey = `${query}|${period}`;
    const pages = groups.get(groupKey) || new Map();
    pages.set(page, (pages.get(page) || 0) + Math.max(0, Number(row.impressions) || 0));
    groups.set(groupKey, pages);
  }

  const semanticMap = normalizeSemanticMap(pageSemantics);
  return [...groups.entries()]
    .filter(([, pages]) => pages.size > 1)
    .map(([groupKey, pages]) => {
      const separator = groupKey.lastIndexOf("|");
      const query = separator >= 0 ? groupKey.slice(0, separator) : groupKey;
      const period = separator >= 0 ? groupKey.slice(separator + 1) : "undated";
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
      return Object.freeze({ query, period, pages: competition, severity, confidence: Number(confidence.toFixed(3)), semanticSimilarity, semanticEvidence: hasSemanticEvidence, similarityThreshold, actionable: severity === "HIGH" && (!hasSemanticEvidence || semanticSimilarity >= similarityThreshold) });
    })
    .filter((item) => item.actionable || item.severity !== "LOW")
    .sort((a, b) => b.pages[0].impressions - a.pages[0].impressions);
}


export function detectSemanticQueryCannibalization(rows = [], {
  minImpressions = 50,
  similarityThreshold = 0.55,
  pageSemantics = []
} = {}) {
  const semanticMap = normalizeSemanticMap(pageSemantics);
  const periods = new Map();

  for (const row of rows) {
    const query = normalizeText(row?.query);
    const page = normalizeUrl(row?.page);
    const startDate = String(row?.startDate || row?.start_date || "").trim();
    const endDate = String(row?.endDate || row?.end_date || "").trim();
    if (!query || !page || !isOwnershipEligibleQuery(query)) continue;

    const period = startDate || endDate ? `${startDate}|${endDate}` : "undated";
    const bucket = periods.get(period) || [];
    bucket.push(row);
    periods.set(period, bucket);
  }

  const results = [];
  for (const [period, periodRows] of periods) {
    const clusters = buildSemanticQueryClusters(periodRows, {
      minImpressions,
      limit: 5000
    });

    for (const cluster of clusters) {
      if (cluster.pageCount < 2) continue;

      const pairScores = [];
      for (let i = 0; i < cluster.pages.length; i += 1) {
        for (let j = i + 1; j < cluster.pages.length; j += 1) {
          const left = semanticMap.get(cluster.pages[i].page);
          const right = semanticMap.get(cluster.pages[j].page);
          if (left && right) pairScores.push(pageSimilarity(left, right));
        }
      }

      const semanticSimilarity = pairScores.length ? Math.max(...pairScores) : 0;
      const semanticEvidence = pairScores.length > 0;
      const semanticConfirmed = !semanticEvidence || semanticSimilarity >= similarityThreshold;
      const dominantShare = cluster.topShare;
      const distributionSeverity =
        dominantShare < 0.7 ? "HIGH" :
        dominantShare < 0.85 ? "MEDIUM" :
        "LOW";
      const severity = semanticConfirmed ? distributionSeverity : "LOW";
      const confidenceBase =
        severity === "HIGH" ? 0.9 :
        severity === "MEDIUM" ? 0.7 :
        0.45;
      const confidence = semanticEvidence
        ? confidenceBase * semanticSimilarity
        : Math.min(confidenceBase, 0.5);

      results.push(Object.freeze({
        clusterKey: cluster.key,
        query: cluster.queries[0]?.displayQuery || cluster.key,
        queryVariants: cluster.queries,
        period,
        pages: cluster.pages,
        totalImpressions: cluster.impressions,
        dominantShare,
        severity,
        confidence: Number(confidence.toFixed(3)),
        semanticSimilarity,
        semanticEvidence,
        similarityThreshold,
        actionable: severity === "HIGH" &&
          (!semanticEvidence || semanticSimilarity >= similarityThreshold)
      }));
    }
  }

  return Object.freeze(
    results
      .filter((item) => item.actionable || item.severity !== "LOW")
      .sort((a, b) => b.totalImpressions - a.totalImpressions || a.clusterKey.localeCompare(b.clusterKey))
  );
}

export { normalizeText, normalizeUrl, jaccard, pageSimilarity, isBrandNavigationQuery, isOwnershipEligibleQuery };
