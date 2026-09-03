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

function normalize(value) { return String(value ?? "").replace(/[\u200c\u200f\u200e]/g, "").replace(/[يى]/g, "ی").replace(/[ك]/g, "ک").replace(/[\s\-_]+/g, " ").trim().toLowerCase(); }
function findTopic(slug) { return TOPICS.find((topic) => topic.slug === slug) || null; }
function isShushtarTopic(topic) { return topic?.slug === "shushtar" || normalize(topic?.name).includes("شوشتر"); }
function localTopicName(topic) { return isShushtarTopic(topic) ? "آموزش موسیقی" : (topic?.name || "آموزش موسیقی"); }
function resolveTopicFromTitle(title, fallback = null) {
  const normalized = normalize(title);
  const titleTopic = TOPICS.map((topic) => ({ topic, score: (topic.aliases || []).filter((alias) => normalized.includes(normalize(alias))).length })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name, "fa"))[0]?.topic || null;
  return titleTopic || findTopic(fallback);
}
function topicForCourse(course) {
  if (!course) return null;
  const instrument = normalize(course.instrument || "");
  const byInstrument = TOPICS.find((topic) => normalize(topic.slug) === instrument);
  if (byInstrument) return byInstrument;
  const normalized = normalize([course.slug, course.title, course.description].filter(Boolean).join(" | "));
  return TOPICS.map((topic) => ({ topic, score: [topic.name, ...(topic.aliases || [])].filter(Boolean).filter((alias) => normalized.includes(normalize(alias))).length })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name, "fa"))[0]?.topic || null;
}
function resolveCandidateTopic(candidate, course) {
  const titleTopic = resolveTopicFromTitle(candidate.title);
  const courseTopic = topicForCourse(course);
  const metadataTopic = findTopic(candidate.instrumentKey);
  if (titleTopic && courseTopic && titleTopic.slug !== courseTopic.slug) return null;
  return titleTopic || courseTopic || metadataTopic;
}
function normalizeBaseUrl(siteUrl) { return String(siteUrl || "https://fatehmusic.ir").replace(/\/$/, ""); }
function findCourseForTopic(topic, courses = []) {
  if (!topic || isShushtarTopic(topic)) return null;
  const aliases = [topic.name, ...(topic.aliases || [])].map(normalize).filter(Boolean);
  return courses.find((course) => aliases.some((alias) => normalize([course?.slug, course?.title, course?.instrument, course?.description].filter(Boolean).join(" | ")).includes(alias))) || null;
}
function buildTitle(topic, intent, course) {
  const name = localTopicName(topic);
  if (intent === "local") return `${name} در شوشتر | راهنمای کلاس و انتخاب دوره`;
  if (intent === "transactional") return `${name}: هزینه، شرایط و ثبت‌نام در دوره`;
  if (intent === "commercial") return `${name}: راهنمای انتخاب دوره مناسب`;
  if (intent === "navigational") return `${name}: معرفی آموزشگاه و مسیر دسترسی`;
  return course?.title ? `${name}: ${INTENT_SUFFIX[intent]} برای شروع یادگیری` : `${name}: ${INTENT_SUFFIX[intent]} یادگیری و تمرین`;
}
function buildQueryAngles(topic, intent, course) {
  const name = localTopicName(topic), courseTitle = course?.title || name;
  const queries = {
    informational: [`چگونه ${name} را شروع کنیم`, `سرفصل های ${name}`, `اشتباهات رایج در ${name}`],
    commercial: [`بهترین دوره ${name}`, `${name} مناسب چه کسانی است`, `مقایسه کلاس ${name}`],
    transactional: [`هزینه کلاس ${name}`, `قیمت دوره ${name}`, `ثبت نام ${name}`],
    local: [`${name} در شوشتر`, `کلاس ${name} شوشتر`, `آموزشگاه ${name} در شوشتر`],
    navigational: [`${courseTitle} آموزشگاه موسیقی فاتح`, `${name} فاتح`, `آدرس آموزشگاه موسیقی فاتح`]
  };
  return Object.freeze(queries[intent] || queries.informational);
}
function buildPriority(intent, articleCount, course, isLocal) { return Math.min(100, (INTENT_PRIORITY[intent] ?? 60) + Math.min(20, Math.max(0, 3 - articleCount) * 8) + (course ? 12 : 0) + (isLocal ? 8 : 0)); }
function buildTargetEntity(topic, course, isLocal, baseUrl) {
  if (isLocal || isShushtarTopic(topic)) return { type: "Place", id: `${baseUrl}/#place-shushtar`, name: "آموزش موسیقی در شوشتر", url: `${baseUrl}/locations/shushtar` };
  if (course) return { type: "Course", id: `${baseUrl}/#course-${course.slug}`, name: course.title, url: `${baseUrl}/courses/${course.slug}` };
  return { type: "Thing", id: `${baseUrl}/#topic-${topic.slug}`, name: topic.name, url: `${baseUrl}/courses` };
}
function buildRecommendedLinks(targetEntity, baseUrl) { return Object.freeze([...new Set([targetEntity.url, `${baseUrl}/locations/shushtar`, `${baseUrl}/register`, `${baseUrl}/blog`])]); }
function canonicalScope(topic, isLocal = false) { return isLocal || isShushtarTopic(topic) ? "shushtar" : "global"; }
function canonicalSlug(topic, isLocal = false, course = null) { if (isLocal || isShushtarTopic(topic)) return `${topic.slug === "shushtar" ? "music-education" : topic.slug}-shushtar`; if (course?.slug) return course.slug; return topic.slug; }
function canonicalAssetKey(item) { return `${item.topic}|${canonicalScope(findTopic(item.topic), Boolean(item.modifierType === "local_shushtar" || item.searchIntent === "local" || item.isLocal))}|${item.course?.slug || "general"}`; }
function areIntentsCompatible(a, b) { return Boolean(COMPATIBLE_INTENTS[a]?.has(b) && COMPATIBLE_INTENTS[b]?.has(a)); }
function choosePrimaryIntent(intents = []) { return [...new Set(intents)].sort((a, b) => (INTENT_PRIORITY[b] ?? 0) - (INTENT_PRIORITY[a] ?? 0))[0] || "informational"; }
function mergeIntents(a = [], b = []) { return [...new Set([...a, ...b])].filter((intent) => INTENTS.includes(intent)); }
function mergeQueryAngles(topic, intents, course) { return Object.freeze([...new Set(intents.flatMap((intent) => buildQueryAngles(topic, intent, course)))].slice(0, 12)); }

function buildBrief(gap, courses = [], siteUrl) {
  const topic = findTopic(gap.topic), intent = gap.missingIntents?.[0]; if (!topic || !intent) return null;
  const baseUrl = normalizeBaseUrl(siteUrl), isLocal = intent === "local" || isShushtarTopic(topic), course = isLocal ? null : findCourseForTopic(topic, courses), targetEntity = buildTargetEntity(topic, course, isLocal, baseUrl), articleCount = Number(gap.articleCount) || 0;
  const action = articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT";
  return Object.freeze({ source: "gap", action, topic: topic.slug, topicName: topic.name, searchIntent: intent, searchIntents: [intent], isLocal, title: buildTitle(topic, intent, course), suggestedSlug: canonicalSlug(topic, isLocal, course), targetEntity, course: course ? Object.freeze({ slug: course.slug, title: course.title, url: `${baseUrl}/courses/${course.slug}` }) : null, priority: buildPriority(intent, articleCount, course, isLocal), articleCount, existingArticleSlugs: gap.articleSlugs || [], rationale: action === "OPTIMIZE_EXISTING" ? `intent «${intent}» برای خوشه «${topic.name}» ناقص است؛ محتوای موجود باید برای پوشش این intent تقویت شود.` : `پوشش intent «${intent}» برای خوشه «${topic.name}» وجود ندارد؛ ایجاد یک محتوای هدفمند این شکاف را پوشش می‌دهد.`, queryAngles: buildQueryAngles(topic, intent, course), recommendedLinks: buildRecommendedLinks(targetEntity, baseUrl) });
}
function buildContentStrategyFromGaps(gaps = [], courses = [], siteUrl) { return gaps.flatMap((gap) => (gap.missingIntents || []).map((intent) => buildBrief({ ...gap, missingIntents: [intent] }, courses, siteUrl)).filter(Boolean)); }

function buildCandidateBrief(candidate, courses = [], siteUrl) {
  const baseUrl = normalizeBaseUrl(siteUrl), explicitCourse = candidate.relatedCourseSlug ? courses.find((item) => item?.slug === candidate.relatedCourseSlug) || null : null;
  const topic = resolveCandidateTopic(candidate, explicitCourse); if (!topic) return null;
  const intent = candidate.intent || "informational", isLocal = candidate.modifierType === "local_shushtar" || normalize(candidate.title).includes("شوشتر") || isShushtarTopic(topic), course = isLocal ? null : (explicitCourse || findCourseForTopic(topic, courses)), targetEntity = buildTargetEntity(topic, course, isLocal, baseUrl);
  return Object.freeze({ source: "topic-engine", action: "NEW_CONTENT", topic: topic.slug, topicName: topic.name, searchIntent: intent, searchIntents: [intent], isLocal, title: candidate.title, suggestedSlug: canonicalSlug(topic, isLocal, course), targetEntity, course: course ? Object.freeze({ slug: course.slug, title: course.title, url: `${baseUrl}/courses/${course.slug}` }) : null, priority: Math.max(0, Math.min(100, Number(candidate.scoreTotal) || 0)), articleCount: 0, existingArticleSlugs: [], rationale: candidate.reasoning || "این موضوع توسط موتور تولید موضوعات کشف و امتیازدهی شده است.", queryAngles: buildQueryAngles(topic, intent, course), recommendedLinks: buildRecommendedLinks(targetEntity, baseUrl), modifierType: candidate.modifierType, scoreBreakdown: candidate.scoreBreakdown || null, topicId: candidate.id ?? null, topicStatus: candidate.status || null });
}

function mergeOpportunity(candidate, gap, siteUrl) {
  const topic = findTopic(candidate.topic); if (!topic) return null;
  const baseUrl = normalizeBaseUrl(siteUrl), course = candidate.course?.slug ? { slug: candidate.course.slug, title: candidate.course.title } : null;
  const searchIntents = mergeIntents(candidate.searchIntents || [candidate.searchIntent], gap.searchIntents || [gap.searchIntent]);
  const isLocal = candidate.isLocal || gap.isLocal || searchIntents.includes("local") || isShushtarTopic(topic);
  const priority = Math.min(100, Math.round(Math.max(candidate.priority, gap.priority) + Math.min(10, Math.abs(candidate.priority - gap.priority) * 0.15)));
  const targetEntity = buildTargetEntity(topic, isLocal ? null : (course ? coursesForMergeCourse(course) : null), isLocal, baseUrl);
  return Object.freeze({ ...candidate, source: "topic-engine+gap", priority, gapDetected: true, gapPriority: gap.priority, gapArticleCount: gap.articleCount, existingArticleSlugs: [...new Set([...(candidate.existingArticleSlugs || []), ...(gap.existingArticleSlugs || [])])], action: gap.articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT", searchIntent: choosePrimaryIntent(searchIntents), searchIntents, isLocal, queryAngles: mergeQueryAngles(topic, searchIntents, isLocal ? null : course), suggestedSlug: canonicalSlug(topic, isLocal, isLocal ? null : course), targetEntity, course: isLocal ? null : candidate.course, rationale: `${candidate.rationale} ${gap.rationale}` });
}
function coursesForMergeCourse(course) { return course ? { slug: course.slug, title: course.title } : null; }

function mergeCompatibleOpportunities(items) {
  const groups = new Map();
  for (const item of items) {
    const key = canonicalAssetKey(item), current = groups.get(key);
    if (!current) { groups.set(key, item); continue; }
    const currentIntents = current.searchIntents || [current.searchIntent], incomingIntents = item.searchIntents || [item.searchIntent];
    const compatible = currentIntents.every((a) => incomingIntents.some((b) => areIntentsCompatible(a, b)));
    if (!compatible) { groups.set(`${key}|${incomingIntents.join(",")}`, item); continue; }
    const mergedIntents = mergeIntents(currentIntents, incomingIntents), preferred = item.priority > current.priority ? item : current, topic = findTopic(preferred.topic);
    groups.set(key, Object.freeze({ ...preferred, source: current.source === item.source ? current.source : "topic-engine+gap", searchIntent: choosePrimaryIntent(mergedIntents), searchIntents: mergedIntents, queryAngles: topic ? mergeQueryAngles(topic, mergedIntents, preferred.course) : preferred.queryAngles, existingArticleSlugs: [...new Set([...(current.existingArticleSlugs || []), ...(item.existingArticleSlugs || [])])], articleCount: Math.max(Number(current.articleCount) || 0, Number(item.articleCount) || 0), action: [current.action, item.action].includes("OPTIMIZE_EXISTING") ? "OPTIMIZE_EXISTING" : preferred.action, gapDetected: Boolean(current.gapDetected || item.gapDetected), rationale: `${current.rationale} ${item.rationale}` }));
  }
  return [...groups.values()];
}

export function buildUnifiedContentOpportunities({ gaps = [], topicCandidates = [], courses = [], siteUrl } = {}) {
  const candidateItems = topicCandidates.map((candidate) => candidate?.title ? buildCandidateBrief(candidate, courses, siteUrl) : null).filter(Boolean);
  const mergedCandidates = mergeCompatibleOpportunities(candidateItems);
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
  const opportunities = mergeCompatibleOpportunities([...mergedByKey.values(), ...unmatchedGaps]).sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "fa"));
  return Object.freeze({ opportunityCount: opportunities.length, highPriorityCount: opportunities.filter((item) => item.priority >= 85).length, newContentCount: opportunities.filter((item) => item.action === "NEW_CONTENT").length, optimizeCount: opportunities.filter((item) => item.action === "OPTIMIZE_EXISTING").length, mergeCount: opportunities.filter((item) => item.action === "MERGE_CONTENT").length, opportunities: Object.freeze(opportunities) });
}

export function buildContentStrategy(gaps = [], courses = [], { siteUrl } = {}) { const briefs = mergeCompatibleOpportunities(buildContentStrategyFromGaps(gaps, courses, siteUrl)); return Object.freeze({ briefCount: briefs.length, highPriorityCount: briefs.filter((item) => item.priority >= 85).length, briefs: Object.freeze(briefs) }); }

export { canonicalAssetKey, areIntentsCompatible };
