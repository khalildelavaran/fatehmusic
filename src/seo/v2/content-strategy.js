// Unified Content Intelligence: intent is metadata on a canonical content asset.
import { TOPICS } from "./topics.js";

const INTENT_PRIORITY = Object.freeze({ transactional: 100, local: 92, commercial: 84, informational: 70, navigational: 58 });
const INTENT_SUFFIX = Object.freeze({ informational: "راهنمای جامع", commercial: "راهنمای انتخاب", transactional: "هزینه و ثبت‌نام", local: "در شوشتر", navigational: "معرفی و مسیر دسترسی" });
const INTENTS = Object.freeze(["informational", "commercial", "transactional", "local", "navigational"]);
const COMPATIBLE_INTENTS = Object.freeze({
  local: new Set(["local", "commercial", "transactional"]),
  commercial: new Set(["local", "commercial", "transactional"]),
  transactional: new Set(["local", "commercial", "transactional"]),
  informational: new Set(["informational"]),
  navigational: new Set(["navigational"])
});
const SCOPE_ONLY_TOPICS = new Set(["shushtar"]);

function normalize(value) { return String(value ?? "").replace(/[\u200c\u200f\u200e]/g, "").replace(/[يى]/g, "ی").replace(/[ك]/g, "ک").replace(/[\s\-_]+/g, " ").trim().toLowerCase(); }
function findTopic(slug) { return TOPICS.find((topic) => topic.slug === slug) || null; }
function isShushtarTopic(topic) { return topic?.slug === "shushtar" || normalize(topic?.name).includes("شوشتر"); }
function localTopicName(topic) { return isShushtarTopic(topic) ? "آموزش موسیقی" : (topic?.name || "آموزش موسیقی"); }
function hasLocalSignal(value) { return normalize(value).includes("شوشتر"); }

function resolveTopicFromTitle(title, fallback = null) {
  const normalized = normalize(title);
  const specific = TOPICS
    .filter((topic) => !SCOPE_ONLY_TOPICS.has(topic.slug) && topic.slug !== "music-education")
    .map((topic) => ({ topic, score: (topic.aliases || []).reduce((sum, alias) => normalized.includes(normalize(alias)) ? sum + normalize(alias).length : sum, 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.topic.name.length - a.topic.name.length || a.topic.name.localeCompare(b.topic.name, "fa"));
  if (specific[0]) return specific[0].topic;
  if (hasLocalSignal(title)) return findTopic("shushtar");
  return findTopic(fallback) || findTopic("music-education");
}

function topicForCourse(course) {
  if (!course) return null;
  const instrument = normalize(course.instrument || "");
  const byInstrument = TOPICS.find((topic) => normalize(topic.slug) === instrument);
  if (byInstrument) return byInstrument;
  const normalized = normalize([course.slug, course.title, course.description].filter(Boolean).join(" | "));
  return TOPICS.map((topic) => ({ topic, score: [topic.name, ...(topic.aliases || [])].filter(Boolean).reduce((sum, alias) => normalized.includes(normalize(alias)) ? sum + normalize(alias).length : sum, 0) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name, "fa"))[0]?.topic || null;
}

function resolveCandidateTopic(candidate, course) {
  const explicitTopic = findTopic(candidate.topic || candidate.topicSlug || candidate.topicId);
  const courseTopic = topicForCourse(course);
  const titleTopic = resolveTopicFromTitle(candidate.title, explicitTopic?.slug);
  const subjectTopic = [explicitTopic, courseTopic, titleTopic].find((topic) => topic && !SCOPE_ONLY_TOPICS.has(topic.slug) && topic.slug !== "music-education");
  return subjectTopic || titleTopic || explicitTopic || findTopic("music-education");
}

function normalizeBaseUrl(siteUrl) { return String(siteUrl || "https://fatehmusic.ir").replace(/\/$/, ""); }
function findCourseForTopic(topic, courses = []) {
  if (!topic || isShushtarTopic(topic) || topic.slug === "music-education") return null;
  const aliases = [topic.name, ...(topic.aliases || [])].map(normalize).filter((value) => value.length >= 3).sort((a, b) => b.length - a.length);
  const ranked = courses.map((course) => {
    const haystack = normalize([course?.slug, course?.title, course?.instrument, course?.description].filter(Boolean).join(" | "));
    const exact = aliases.find((alias) => haystack === alias || haystack.split(" ").includes(alias));
    const score = exact ? 1000 + exact.length : aliases.reduce((sum, alias) => sum + (haystack.includes(alias) ? alias.length : 0), 0);
    return { course, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || String(a.course?.slug || "").localeCompare(String(b.course?.slug || "")));
  return ranked[0]?.course || null;
}

function buildTitle(topic, intent, course) {
  const name = localTopicName(topic), courseName = course?.title || name;
  if (intent === "local") return `${name} در شوشتر | راهنمای کلاس و انتخاب دوره`;
  if (intent === "transactional") return `${courseName}: هزینه، شرایط و ثبت‌نام در دوره`;
  if (intent === "commercial") return `${courseName}: راهنمای انتخاب دوره مناسب`;
  if (intent === "navigational") return `${courseName}: معرفی آموزشگاه و مسیر دسترسی`;
  return course ? `${courseName}: ${INTENT_SUFFIX[intent]}` : `${name}: ${INTENT_SUFFIX[intent]} یادگیری و تمرین`;
}

function buildQueryAngles(topic, intent, course) {
  const name = course?.title || localTopicName(topic), broad = localTopicName(topic);
  const queries = {
    informational: [`چگونه ${name} را شروع کنیم`, `سرفصل های ${name}`, `اشتباهات رایج در ${name}`],
    commercial: [`بهترین دوره ${name}`, `${name} مناسب چه کسانی است`, `مقایسه کلاس ${name}`],
    transactional: [`هزینه کلاس ${name}`, `قیمت دوره ${name}`, `ثبت نام ${name}`],
    local: [`${name} در شوشتر`, `کلاس ${name} شوشتر`, `آموزشگاه ${name} در شوشتر`],
    navigational: [`${name} آموزشگاه موسیقی فاتح`, `${name} فاتح`, `آدرس آموزشگاه موسیقی فاتح`]
  };
  return Object.freeze(queries[intent] || queries.informational);
}
function buildPriority(intent, articleCount, course, isLocal) { return Math.min(100, (INTENT_PRIORITY[intent] ?? 60) + Math.min(20, Math.max(0, 3 - articleCount) * 8) + (course ? 12 : 0) + (isLocal ? 8 : 0)); }
function buildTargetEntity(topic, course, isLocal, baseUrl) {
  if (course) return { type: "Course", id: `${baseUrl}/#course-${course.slug}`, name: course.title, url: `${baseUrl}/courses/${course.slug}` };
  if (isLocal || isShushtarTopic(topic)) return { type: "Place", id: `${baseUrl}/#place-shushtar`, name: "آموزش موسیقی در شوشتر", url: `${baseUrl}/locations/shushtar` };
  return { type: "Thing", id: `${baseUrl}/#topic-${topic.slug}`, name: topic.name, url: `${baseUrl}/courses` };
}
function buildRecommendedLinks(targetEntity, baseUrl) { return Object.freeze([...new Set([targetEntity.url, `${baseUrl}/locations/shushtar`, `${baseUrl}/register`, `${baseUrl}/blog`])]); }
function canonicalScope(topic, isLocal = false) { return isLocal || isShushtarTopic(topic) ? "shushtar" : "global"; }
function canonicalSlug(topic, isLocal = false, course = null) { if (isLocal || isShushtarTopic(topic)) return `${topic.slug === "shushtar" ? "music-education" : topic.slug}${course?.slug ? `-${course.slug}` : ""}-shushtar`; return course?.slug || topic.slug; }
function canonicalAssetKey(item) { const topic = findTopic(item.topic); const local = Boolean(item.scope === "shushtar" || item.modifierType === "local_shushtar" || item.searchIntent === "local" || item.isLocal || isShushtarTopic(topic)); return `${topic?.slug || item.topic}|${canonicalScope(topic, local)}|${item.course?.slug || "general"}`; }
function areIntentsCompatible(a, b) { return Boolean(COMPATIBLE_INTENTS[a]?.has(b) && COMPATIBLE_INTENTS[b]?.has(a)); }
function choosePrimaryIntent(intents = []) { return [...new Set(intents)].sort((a, b) => (INTENT_PRIORITY[b] ?? 0) - (INTENT_PRIORITY[a] ?? 0))[0] || "informational"; }
function mergeIntents(a = [], b = []) { return [...new Set([...a, ...b])].filter((intent) => INTENTS.includes(intent)); }
function mergeQueryAngles(topic, intents, course) { return Object.freeze([...new Set(intents.flatMap((intent) => buildQueryAngles(topic, intent, course)))].slice(0, 15)); }
function makeCourseRef(course, baseUrl) { return course ? Object.freeze({ slug: course.slug, title: course.title, url: `${baseUrl}/courses/${course.slug}` }) : null; }

function buildBrief(gap, courses = [], siteUrl) {
  const topic = findTopic(gap.topic), intent = gap.missingIntents?.[0]; if (!topic || !intent) return null;
  const baseUrl = normalizeBaseUrl(siteUrl), isLocal = gap.scope === "shushtar" || intent === "local" || isShushtarTopic(topic);
  const course = gap.courseSlug ? courses.find((item) => item?.slug === gap.courseSlug) || null : (isLocal && isShushtarTopic(topic) ? null : findCourseForTopic(topic, courses));
  const targetEntity = buildTargetEntity(topic, course, isLocal, baseUrl), articleCount = Number(gap.articleCount) || 0, action = articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT";
  return Object.freeze({ source: "gap", action, topic: topic.slug, topicName: topic.name, searchIntent: intent, searchIntents: [intent], isLocal, scope: gap.scope || canonicalScope(topic, isLocal), title: buildTitle(topic, intent, course), suggestedSlug: canonicalSlug(topic, isLocal, course), targetEntity, course: makeCourseRef(course, baseUrl), priority: buildPriority(intent, articleCount, course, isLocal), articleCount, existingArticleSlugs: gap.articleSlugs || [], rationale: action === "OPTIMIZE_EXISTING" ? `intent «${intent}» برای خوشه «${topic.name}» ناقص است؛ محتوای موجود باید برای پوشش این intent تقویت شود.` : `پوشش intent «${intent}» برای خوشه «${topic.name}» وجود ندارد؛ ایجاد یک محتوای هدفمند این شکاف را پوشش می‌دهد.`, queryAngles: buildQueryAngles(topic, intent, course), recommendedLinks: buildRecommendedLinks(targetEntity, baseUrl) });
}
function buildContentStrategyFromGaps(gaps = [], courses = [], siteUrl) { return gaps.flatMap((gap) => (gap.missingIntents || []).map((intent) => buildBrief({ ...gap, missingIntents: [intent] }, courses, siteUrl)).filter(Boolean)); }

function buildCandidateBrief(candidate, courses = [], siteUrl) {
  const baseUrl = normalizeBaseUrl(siteUrl), explicitCourse = candidate.relatedCourseSlug ? courses.find((item) => item?.slug === candidate.relatedCourseSlug) || null;
  const topic = resolveCandidateTopic(candidate, explicitCourse); if (!topic) return null;
  const intent = candidate.intent || "informational", isLocal = candidate.modifierType === "local_shushtar" || hasLocalSignal(candidate.title) || isShushtarTopic(topic);
  const course = explicitCourse || (topic.slug === "shushtar" ? null : findCourseForTopic(topic, courses));
  return Object.freeze({ source: "topic-engine", action: "NEW_CONTENT", topic: topic.slug, topicName: topic.name, searchIntent: intent, searchIntents: [intent], isLocal, scope: canonicalScope(topic, isLocal), title: candidate.title, suggestedSlug: canonicalSlug(topic, isLocal, course), targetEntity: buildTargetEntity(topic, course, isLocal, baseUrl), course: makeCourseRef(course, baseUrl), priority: Math.max(0, Math.min(100, Number(candidate.scoreTotal) || 0)), articleCount: 0, existingArticleSlugs: [], rationale: candidate.reasoning || "این موضوع توسط موتور تولید موضوعات کشف و امتیازدهی شده است.", queryAngles: buildQueryAngles(topic, intent, course), recommendedLinks: buildRecommendedLinks(buildTargetEntity(topic, course, isLocal, baseUrl), baseUrl), modifierType: candidate.modifierType, scoreBreakdown: candidate.scoreBreakdown || null, topicId: candidate.id ?? null, topicStatus: candidate.status || null });
}

function mergeOpportunity(candidate, gap, siteUrl) {
  const topic = findTopic(candidate.topic); if (!topic) return null;
  const baseUrl = normalizeBaseUrl(siteUrl), course = candidate.course || gap.course || null;
  const searchIntents = mergeIntents(candidate.searchIntents || [candidate.searchIntent], gap.searchIntents || [gap.searchIntent]);
  const isLocal = Boolean(candidate.isLocal || gap.isLocal || gap.scope === "shushtar" || searchIntents.includes("local") || isShushtarTopic(topic));
  const targetEntity = buildTargetEntity(topic, course, isLocal, baseUrl);
  return Object.freeze({ ...candidate, source: "topic-engine+gap", priority: Math.min(100, Math.round(Math.max(candidate.priority, gap.priority) + Math.min(10, Math.abs(candidate.priority - gap.priority) * 0.15))), gapDetected: true, gapPriority: gap.priority, gapArticleCount: gap.articleCount, existingArticleSlugs: [...new Set([...(candidate.existingArticleSlugs || []), ...(gap.existingArticleSlugs || [])])], action: gap.articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT", searchIntent: choosePrimaryIntent(searchIntents), searchIntents, isLocal, scope: gap.scope || candidate.scope || canonicalScope(topic, isLocal), queryAngles: mergeQueryAngles(topic, searchIntents, course), suggestedSlug: canonicalSlug(topic, isLocal, course), targetEntity, course: makeCourseRef(course, baseUrl), rationale: `${candidate.rationale} ${gap.rationale}` });
}

function mergeCompatibleOpportunities(items, siteUrl) {
  const groups = new Map();
  const baseUrl = normalizeBaseUrl(siteUrl);
  for (const item of items) {
    const key = canonicalAssetKey(item), current = groups.get(key);
    if (!current) { groups.set(key, item); continue; }
    const currentIntents = current.searchIntents || [current.searchIntent], incomingIntents = item.searchIntents || [item.searchIntent];
    const compatible = currentIntents.every((a) => incomingIntents.some((b) => areIntentsCompatible(a, b)));
    if (!compatible) { groups.set(`${key}|${incomingIntents.join(",")}`, item); continue; }
    const mergedIntents = mergeIntents(currentIntents, incomingIntents), preferred = item.priority > current.priority ? item : current, topic = findTopic(preferred.topic), preferredCourse = preferred.course || current.course || item.course, local = Boolean(current.isLocal || item.isLocal);
    groups.set(key, Object.freeze({ ...preferred, source: current.source === item.source ? current.source : "topic-engine+gap", searchIntent: choosePrimaryIntent(mergedIntents), searchIntents: mergedIntents, queryAngles: topic ? mergeQueryAngles(topic, mergedIntents, preferredCourse) : preferred.queryAngles, existingArticleSlugs: [...new Set([...(current.existingArticleSlugs || []), ...(item.existingArticleSlugs || [])])], articleCount: Math.max(Number(current.articleCount) || 0, Number(item.articleCount) || 0), action: [current.action, item.action].includes("OPTIMIZE_EXISTING") ? "OPTIMIZE_EXISTING" : preferred.action, gapDetected: Boolean(current.gapDetected || item.gapDetected), isLocal: local, scope: preferred.scope || current.scope || item.scope || canonicalScope(topic, local), course: makeCourseRef(preferredCourse, baseUrl), targetEntity: topic ? buildTargetEntity(topic, preferredCourse, local, baseUrl) : preferred.targetEntity, suggestedSlug: topic ? canonicalSlug(topic, local, preferredCourse) : preferred.suggestedSlug, rationale: `${current.rationale} ${item.rationale}` }));
  }
  return [...groups.values()];
}

export function buildUnifiedContentOpportunities({ gaps = [], topicCandidates = [], courses = [], siteUrl } = {}) {
  const candidateItems = topicCandidates.map((candidate) => candidate?.title ? buildCandidateBrief(candidate, courses, siteUrl) : null).filter(Boolean);
  const mergedCandidates = mergeCompatibleOpportunities(candidateItems, siteUrl);
  const mergedByKey = new Map(mergedCandidates.map((item) => [canonicalAssetKey(item), item]));
  const unmatchedGaps = [];
  for (const gap of buildContentStrategyFromGaps(gaps, courses, siteUrl)) {
    const key = canonicalAssetKey(gap), candidate = mergedByKey.get(key);
    if (candidate) {
      const candidateIntents = candidate.searchIntents || [candidate.searchIntent], gapIntents = gap.searchIntents || [gap.searchIntent];
      const compatible = candidateIntents.every((a) => gapIntents.some((b) => areIntentsCompatible(a, b)));
      if (compatible) { mergedByKey.set(key, mergeOpportunity(candidate, gap, siteUrl)); continue; }
    }
    unmatchedGaps.push(gap);
  }
  const opportunities = mergeCompatibleOpportunities([...mergedByKey.values(), ...unmatchedGaps], siteUrl).sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "fa"));
  return Object.freeze({ opportunityCount: opportunities.length, highPriorityCount: opportunities.filter((item) => item.priority >= 85).length, newContentCount: opportunities.filter((item) => item.action === "NEW_CONTENT").length, optimizeCount: opportunities.filter((item) => item.action === "OPTIMIZE_EXISTING").length, mergeCount: opportunities.filter((item) => item.action === "MERGE_CONTENT").length, opportunities: Object.freeze(opportunities) });
}

export function buildContentStrategy(gaps = [], courses = [], { siteUrl } = {}) { const briefs = mergeCompatibleOpportunities(buildContentStrategyFromGaps(gaps, courses, siteUrl), siteUrl); return Object.freeze({ briefCount: briefs.length, highPriorityCount: briefs.filter((item) => item.priority >= 85).length, briefs: Object.freeze(briefs) }); }
