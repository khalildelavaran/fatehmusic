import { classifyIntent } from "./intents.js";
import { areIntentsCompatible, choosePrimaryIntent, mergeIntents } from "./content-strategy/policy.js";
import {
  findTopic,
  isShushtarTopic,
  hasLocalSignal,
  resolveCandidateTopic,
  findCourseFromTitle,
  findComparisonCourses,
  findCourseForTopic,
  normalizeBaseUrl
} from "./content-strategy/resolvers.js";
import {
  buildTitle,
  buildQueryAngles,
  buildPriority,
  buildTargetEntity,
  buildRecommendedLinks,
  canonicalScope,
  suggestedArticleSlug,
  canonicalContentAngle,
  mergeQueryAngles,
  makeCourseRef
} from "./content-strategy/builders.js";
import { normalizeSemanticText } from "../helpers/text.js";

function canonicalAssetKey(item) {
  const topic = findTopic(item.topic);
  const local = Boolean(item.scope === "shushtar" || item.modifierType === "local_shushtar" || item.searchIntent === "local" || item.isLocal || isShushtarTopic(topic));
  const audience = normalizeSemanticText(item.audience || "");
  const level = normalizeSemanticText(item.level || "");
  const angle = canonicalContentAngle({ ...item, scope: local ? "shushtar" : item.scope });

  // Comparison articles are multi-course assets. Their identity must include
  // the actual comparison title, otherwise every comparison with the same
  // audience/level collapses into one queue item.
  if (item.modifierType === "comparison" || angle === "comparison") {
    return ["comparison-v1", normalizeSemanticText(item.title), audience, level].join("|");
  }

  const courseKey = item.course?.slug || item.courseSlug || "general";
  return [topic?.slug || item.topic, canonicalScope(topic, local), courseKey, angle, audience, level].join("|");
}
export { areIntentsCompatible, suggestedArticleSlug };
function buildBrief(gap, courses = [], siteUrl) {
  const topic = findTopic(gap.topic); const intent = gap.missingIntents?.[0]; if (!topic || !intent) return null; const baseUrl = normalizeBaseUrl(siteUrl); const isLocal = gap.scope === "shushtar" || intent === "local" || isShushtarTopic(topic);
  const course = gap.courseSlug ? courses.find((item) => item?.slug === gap.courseSlug) || null : isLocal && isShushtarTopic(topic) ? null : findCourseForTopic(topic, courses, gap.title || "");
  const articleCount = Number(gap.articleCount) || 0; const action = articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT"; const targetEntity = buildTargetEntity(topic, course, isLocal, baseUrl);
  const intentConfidence = classifyIntent({
    path: isLocal ? "/blog/local" : "/blog",
    title: buildTitle(topic, intent, course),
    keywords: [topic.name, course?.title || ""],
    entityType: "Article"
  }).confidence;
  return Object.freeze({ source: "gap", action, topic: topic.slug, topicName: topic.name, searchIntent: intent, searchIntents: [intent], intentConfidence, isLocal, scope: gap.scope || canonicalScope(topic, isLocal), title: buildTitle(topic, intent, course), suggestedSlug: suggestedArticleSlug({ topic: topic.slug, scope: gap.scope, isLocal, modifierType: isLocal ? "local_shushtar" : intent, searchIntent: intent, course, courseSlug: course?.slug || gap.courseSlug || null, articleCount, existingArticleSlugs: gap.articleSlugs || [] }), targetEntity, course: makeCourseRef(course, baseUrl), courseSlug: gap.courseSlug || course?.slug || null, priority: buildPriority(intent, articleCount, course, isLocal), articleCount, existingArticleSlugs: gap.articleSlugs || [], rationale: action === "OPTIMIZE_EXISTING" ? `intent «${intent}» برای خوشه «${topic.name}» ناقص است؛ محتوای موجود باید برای پوشش این intent تقویت شود.` : `پوشش intent «${intent}» برای خوشه «${topic.name}» وجود ندارد؛ ایجاد یک محتوای هدفمند این شکاف را پوشش می‌دهد.`, queryAngles: buildQueryAngles(topic, intent, course), recommendedLinks: buildRecommendedLinks(targetEntity, baseUrl), modifierType: isLocal ? "local_shushtar" : null, audience: "", level: "" });
}
function buildContentStrategyFromGaps(gaps = [], courses = [], siteUrl) { return gaps.flatMap((gap) => (gap.missingIntents || []).map((intent) => buildBrief({ ...gap, missingIntents: [intent] }, courses, siteUrl)).filter(Boolean)); }
function buildCandidateBrief(candidate, courses = [], siteUrl) {
  const baseUrl = normalizeBaseUrl(siteUrl);
  const normalizedTitle = normalizeSemanticText(candidate.title);
  const comparisonCourses = candidate.modifierType === "comparison"
    ? findComparisonCourses(candidate, courses)
    : [];
  const isComparison = comparisonCourses.length === 2;
  const titleCourse = isComparison ? null : findCourseFromTitle(candidate.title, courses);
  const explicitCourse = isComparison ? null : (titleCourse || (candidate.relatedCourseSlug ? courses.find((item) => item?.slug === candidate.relatedCourseSlug) || null : null));
  const topic = isComparison ? findTopic("music-education") : resolveCandidateTopic(candidate, explicitCourse);
  if (!topic) return null;
  const intent = candidate.intent || "informational";
  const isLocal = !isComparison && (candidate.modifierType === "local_shushtar" || hasLocalSignal(candidate.title) || isShushtarTopic(topic));
  const course = isComparison ? null : (explicitCourse || (topic.slug === "shushtar" ? null : findCourseForTopic(topic, courses, candidate.title)));
  const intentConfidence = classifyIntent({
    path: isComparison ? "/blog/comparison" : "/blog",
    title: candidate.title,
    keywords: [topic.name, course?.title || ""],
    entityType: "Article"
  }).confidence;

  const initialAction = ["NEW_CONTENT", "OPTIMIZE_EXISTING", "EXPAND", "LINK", "MERGE_CONTENT", "MONITOR"]
    .includes(String(candidate.initialAction || ""))
    ? String(candidate.initialAction)
    : "NEW_CONTENT";
  const articleCount = Math.max(0, Number(candidate.initialArticleCount) || 0);
  const existingArticleSlugs = Array.isArray(candidate.initialExistingArticleSlugs)
    ? candidate.initialExistingArticleSlugs.filter(Boolean)
    : [];
  const targetEntity = candidate.initialTargetEntity?.url
    ? Object.freeze(candidate.initialTargetEntity)
    : buildTargetEntity(topic, course, isLocal, baseUrl);

  const recommendedLinks = isComparison
    ? Object.freeze([...new Set([
        ...comparisonCourses.map((item) => baseUrl + "/courses/" + item.slug),
        ...buildRecommendedLinks(targetEntity, baseUrl)
      ])])
    : buildRecommendedLinks(targetEntity, baseUrl);
  const queryAngles = isComparison
    ? Object.freeze([
        comparisonCourses[0].title + " یا " + comparisonCourses[1].title,
        "تفاوت " + comparisonCourses[0].title + " و " + comparisonCourses[1].title,
        ...buildQueryAngles(topic, intent, course)
      ].slice(0, 6))
    : buildQueryAngles(topic, intent, course);

  const marketAngles = Array.isArray(candidate.marketQueryAngles)
    ? candidate.marketQueryAngles.filter(Boolean)
    : [];

  return Object.freeze({
    source: candidate.source || "topic-engine",
    action: initialAction,
    topic: topic.slug,
    topicName: topic.name,
    searchIntent: intent,
    searchIntents: [intent],
    intentConfidence,
    isLocal,
    scope: canonicalScope(topic, isLocal),
    title: candidate.title,
    suggestedSlug: isComparison
      ? "comparison-" + slugifyArticleTitle(candidate.title).slice(0, 70).replace(/-+$/g, "")
      : suggestedArticleSlug({
          topic: topic.slug,
          scope: canonicalScope(topic, isLocal),
          isLocal,
          modifierType: candidate.modifierType || intent,
          searchIntent: intent,
          course,
          audience: candidate.audience || "",
          level: candidate.level || "",
          articleCount,
          existingArticleSlugs
        }),
    targetEntity,
    course: makeCourseRef(course, baseUrl),
    comparisonCourses: comparisonCourses.map((item) => makeCourseRef(item, baseUrl)).filter(Boolean),
    courseSlug: course?.slug || null,
    // Market-discovery candidates carry their Ahrefs evidence separately.
    // Keep the structural base priority independent so the same market signal
    // is not counted once during candidate generation and again during scoring.
    priority: candidate.marketDiscovery
      ? buildPriority(intent, articleCount, course, isLocal)
      : Math.max(0, Math.min(100, Number(candidate.scoreTotal) || 0)),
    articleCount,
    existingArticleSlugs,
    rationale: candidate.rationale || "این موضوع توسط موتور تولید موضوعات کشف و امتیازدهی شده است.",
    queryAngles: Object.freeze([...new Set([...queryAngles, ...marketAngles])].slice(0, 15)),
    recommendedLinks,
    modifierType: candidate.modifierType || null,
    audience: candidate.audience || "",
    level: candidate.level || "",
    scoreBreakdown: candidate.scoreBreakdown || null,
    topicId: candidate.id ?? null,
    topicStatus: candidate.status || null,
    marketDiscovery: Boolean(candidate.marketDiscovery),
    marketClassification: candidate.marketClassification || null,
    marketBestPosition: Number.isFinite(Number(candidate.marketBestPosition)) ? Number(candidate.marketBestPosition) : null,
    marketBestPositionUrl: candidate.marketBestPositionUrl || null,
    marketScore: Number.isFinite(Number(candidate.marketScore)) ? Number(candidate.marketScore) : null
  });
}
function mergeOpportunity(candidate, gap, siteUrl) {
  const topic = findTopic(candidate.topic);
  if (!topic) return null;

  const baseUrl = normalizeBaseUrl(siteUrl);
  const course = candidate.course || gap.course || null;
  if (candidate.course && gap.course && candidate.course.slug !== gap.course.slug) return null;

  const searchIntents = mergeIntents(
    candidate.searchIntents || [candidate.searchIntent],
    gap.searchIntents || [gap.searchIntent]
  );
  const primaryIntent = choosePrimaryIntent(searchIntents);
  const isLocal = Boolean(
    candidate.isLocal ||
    gap.isLocal ||
    gap.scope === "shushtar" ||
    searchIntents.includes("local") ||
    isShushtarTopic(topic)
  );
  const articleCount = Math.max(Number(candidate.articleCount) || 0, Number(gap.articleCount) || 0);
  const existingArticleSlugs = [...new Set([
    ...(candidate.existingArticleSlugs || []),
    ...(gap.existingArticleSlugs || [])
  ])];
  const action = articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT";
  const targetEntity = buildTargetEntity(topic, course, isLocal, baseUrl);

  return Object.freeze({
    ...candidate,
    source: "topic-engine+gap",
    priority: Math.min(
      100,
      Math.round(
        Math.max(candidate.priority, gap.priority) +
        Math.min(10, Math.abs(candidate.priority - gap.priority) * 0.15)
      )
    ),
    gapDetected: true,
    gapPriority: gap.priority,
    gapArticleCount: gap.articleCount,
    existingArticleSlugs,
    action,
    searchIntent: primaryIntent,
    searchIntents,
    isLocal,
    scope: gap.scope || candidate.scope || canonicalScope(topic, isLocal),
    queryAngles: mergeQueryAngles(topic, searchIntents, course),
    suggestedSlug: suggestedArticleSlug({
      topic: topic.slug,
      scope: gap.scope,
      isLocal,
      modifierType: isLocal ? "local_shushtar" : primaryIntent,
      searchIntent: primaryIntent,
      course,
      audience: candidate.audience || gap.audience || "",
      level: candidate.level || gap.level || "",
      articleCount,
      existingArticleSlugs
    }),
    targetEntity,
    course: makeCourseRef(course, baseUrl),
    courseSlug: candidate.courseSlug || gap.courseSlug || course?.slug || null,
    audience: candidate.audience || gap.audience || "",
    level: candidate.level || gap.level || "",
    rationale: candidate.rationale || gap.rationale
  });
}
function mergeCompatibleOpportunities(items, siteUrl) {
  const groups = new Map(); const baseUrl = normalizeBaseUrl(siteUrl);
  for (const item of items) {
    const key = canonicalAssetKey(item); const current = groups.get(key); if (!current) { groups.set(key, item); continue; }
    const currentIntents = current.searchIntents || [current.searchIntent]; const incomingIntents = item.searchIntents || [item.searchIntent]; const compatible = currentIntents.every((a) => incomingIntents.some((b) => areIntentsCompatible(a, b)));
    if (!compatible || (current.courseSlug && item.courseSlug && current.courseSlug !== item.courseSlug)) { groups.set(`${key}|${incomingIntents.join(",")}|${item.courseSlug || "general"}`, item); continue; }
    const mergedIntents = mergeIntents(currentIntents, incomingIntents); const preferred = item.priority > current.priority ? item : current; const topic = findTopic(preferred.topic); const preferredCourse = preferred.course || current.course || item.course || null; const local = Boolean(current.isLocal || item.isLocal);
    groups.set(key, Object.freeze({ ...preferred, source: current.source === item.source ? current.source : "topic-engine+gap", searchIntent: choosePrimaryIntent(mergedIntents), searchIntents: mergedIntents, queryAngles: topic ? mergeQueryAngles(topic, mergedIntents, preferredCourse) : preferred.queryAngles, existingArticleSlugs: [...new Set([...(current.existingArticleSlugs || []), ...(item.existingArticleSlugs || [])])], articleCount: Math.max(Number(current.articleCount) || 0, Number(item.articleCount) || 0), action: [current.action, item.action].includes("OPTIMIZE_EXISTING") ? "OPTIMIZE_EXISTING" : preferred.action, gapDetected: Boolean(current.gapDetected || item.gapDetected), isLocal: local, scope: preferred.scope || current.scope || item.scope || canonicalScope(topic, local), course: makeCourseRef(preferredCourse, baseUrl), targetEntity: topic ? buildTargetEntity(topic, preferredCourse, local, baseUrl) : preferred.targetEntity, suggestedSlug: topic ? suggestedArticleSlug({ topic: topic.slug, scope: preferred.scope || current.scope || item.scope, isLocal: local, modifierType: preferred.modifierType || preferred.searchIntent, searchIntent: preferred.searchIntent, course: preferredCourse, audience: preferred.audience || current.audience || item.audience || "", level: preferred.level || current.level || item.level || "", articleCount: Math.max(Number(current.articleCount) || 0, Number(item.articleCount) || 0), existingArticleSlugs: [...new Set([...(current.existingArticleSlugs || []), ...(item.existingArticleSlugs || [])])] }) : preferred.suggestedSlug, courseSlug: preferred.courseSlug || current.courseSlug || item.courseSlug || preferredCourse?.slug || null, audience: preferred.audience || current.audience || item.audience || "", level: preferred.level || current.level || item.level || "", rationale: preferred.rationale || current.rationale || item.rationale }));
  }
  return [...groups.values()];
}
/** @param {{gaps?: object[], topicCandidates?: object[], courses?: object[], siteUrl?: string}} options */
export function buildUnifiedContentOpportunities({ gaps = [], topicCandidates = [], courses = [], siteUrl } = {}) {
  const candidateItems = topicCandidates.map((candidate) => candidate?.title ? buildCandidateBrief(candidate, courses, siteUrl) : null).filter(Boolean); const mergedCandidates = mergeCompatibleOpportunities(candidateItems, siteUrl); const mergedByKey = new Map(mergedCandidates.map((item) => [canonicalAssetKey(item), item])); const unmatchedGaps = [];
  for (const gap of buildContentStrategyFromGaps(gaps, courses, siteUrl)) { const key = canonicalAssetKey(gap); const candidate = mergedByKey.get(key); if (candidate) { const candidateIntents = candidate.searchIntents || [candidate.searchIntent]; const gapIntents = gap.searchIntents || [gap.searchIntent]; const compatible = candidateIntents.every((a) => gapIntents.some((b) => areIntentsCompatible(a, b))); if (compatible && (!candidate.courseSlug || !gap.courseSlug || candidate.courseSlug === gap.courseSlug)) { mergedByKey.set(key, mergeOpportunity(candidate, gap, siteUrl)); continue; } } unmatchedGaps.push(gap); }
  const opportunities = mergeCompatibleOpportunities([...mergedByKey.values(), ...unmatchedGaps], siteUrl).sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "fa"));
  return Object.freeze({ opportunityCount: opportunities.length, highPriorityCount: opportunities.filter((item) => item.priority >= 85).length, newContentCount: opportunities.filter((item) => item.action === "NEW_CONTENT").length, optimizeCount: opportunities.filter((item) => item.action === "OPTIMIZE_EXISTING").length, mergeCount: opportunities.filter((item) => item.action === "MERGE_CONTENT").length, opportunities: Object.freeze(opportunities) });
}
export function buildContentStrategy(gaps = [], courses = [], { siteUrl } = {}) { const briefs = mergeCompatibleOpportunities(buildContentStrategyFromGaps(gaps, courses, siteUrl), siteUrl); return Object.freeze({ briefCount: briefs.length, highPriorityCount: briefs.filter((item) => item.priority >= 85).length, briefs: Object.freeze(briefs) }); }
