/** Unified Content Intelligence: resolves topic candidates and SEO/GEO gaps into one dashboard queue. */
import { TOPICS } from "./topics.js";
const INTENT_PRIORITY = Object.freeze({ transactional: 100, local: 92, commercial: 84, informational: 70, navigational: 58 });
const INTENT_SUFFIX = Object.freeze({ informational: "راهنمای جامع", commercial: "راهنمای انتخاب", transactional: "هزینه و ثبت‌نام", local: "در شوشتر", navigational: "معرفی و مسیر دسترسی" });
function normalize(value) { return String(value ?? "").replace(/[\u200c\u200f\u200e]/g, "").replace(/[يى]/g, "ی").replace(/[ك]/g, "ک").trim().toLowerCase(); }
function findTopic(slug) { return TOPICS.find((topic) => topic.slug === slug) || null; }
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
  if (!topic) return null;
  const aliases = [topic.name, ...(topic.aliases || [])].map(normalize).filter(Boolean);
  return courses.find((course) => aliases.some((alias) => normalize([course?.slug, course?.title, course?.instrument, course?.description].filter(Boolean).join(" | ")).includes(alias))) || null;
}
function buildTitle(topic, intent, course) {
  const name = topic?.name || "آموزش موسیقی";
  if (intent === "local") return `${name} در شوشتر | راهنمای کلاس و انتخاب دوره`;
  if (intent === "transactional") return `${name}: هزینه، شرایط و ثبت‌نام در دوره`;
  if (intent === "commercial") return `${name}: راهنمای انتخاب دوره مناسب`;
  if (intent === "navigational") return `${name}: معرفی آموزشگاه و مسیر دسترسی`;
  return course?.title ? `${name}: ${INTENT_SUFFIX[intent]} برای شروع یادگیری` : `${name}: ${INTENT_SUFFIX[intent]} یادگیری و تمرین`;
}
function buildQueryAngles(topic, intent, course) {
  const name = topic?.name || "آموزش موسیقی", courseTitle = course?.title || name;
  const queries = { informational: [`چگونه ${name} را شروع کنیم`, `سرفصل های ${name}`, `اشتباهات رایج در ${name}`], commercial: [`بهترین دوره ${name}`, `${name} مناسب چه کسانی است`, `مقایسه کلاس ${name}`], transactional: [`هزینه کلاس ${name}`, `قیمت دوره ${name}`, `ثبت نام ${name}`], local: [`${name} در شوشتر`, `کلاس ${name} شوشتر`, `آموزشگاه ${name} در شوشتر`], navigational: [`${courseTitle} آموزشگاه موسیقی فاتح`, `${name} فاتح`, `آدرس آموزشگاه موسیقی فاتح`] };
  return Object.freeze(queries[intent] || queries.informational);
}
function buildPriority(intent, articleCount, course, isLocal) { return Math.min(100, (INTENT_PRIORITY[intent] ?? 60) + Math.min(20, Math.max(0, 3 - articleCount) * 8) + (course ? 12 : 0) + (isLocal ? 8 : 0)); }
function buildTargetEntity(topic, course, isLocal, baseUrl) {
  if (isLocal) return { type: "Place", id: `${baseUrl}/#place-shushtar`, name: "آموزش موسیقی در شوشتر", url: `${baseUrl}/locations/shushtar` };
  if (course) return { type: "Course", id: `${baseUrl}/#course-${course.slug}`, name: course.title, url: `${baseUrl}/courses/${course.slug}` };
  return { type: "Thing", id: `${baseUrl}/#topic-${topic.slug}`, name: topic.name, url: `${baseUrl}/courses` };
}
function buildRecommendedLinks(targetEntity, baseUrl) { return Object.freeze([...new Set([targetEntity.url, `${baseUrl}/locations/shushtar`, `${baseUrl}/register`, `${baseUrl}/blog`])]); }
function buildBrief(gap, courses = [], siteUrl) {
  const topic = findTopic(gap.topic), intent = gap.missingIntents?.[0]; if (!topic || !intent) return null;
  const baseUrl = normalizeBaseUrl(siteUrl), course = findCourseForTopic(topic, courses), isLocal = intent === "local" || topic.slug === "shushtar";
  const targetEntity = buildTargetEntity(topic, course, isLocal, baseUrl), articleCount = Number(gap.articleCount) || 0;
  const action = articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT";
  return Object.freeze({ source: "gap", action, topic: topic.slug, topicName: topic.name, searchIntent: intent, title: buildTitle(topic, intent, course), suggestedSlug: `${topic.slug}-${intent}`, targetEntity, course: course ? Object.freeze({ slug: course.slug, title: course.title, url: `${baseUrl}/courses/${course.slug}` }) : null, priority: buildPriority(intent, articleCount, course, isLocal), articleCount, existingArticleSlugs: gap.articleSlugs || [], rationale: action === "OPTIMIZE_EXISTING" ? `intent «${intent}» برای خوشه «${topic.name}» ناقص است؛ محتوای موجود باید برای پوشش این intent تقویت شود.` : `پوشش intent «${intent}» برای خوشه «${topic.name}» وجود ندارد؛ ایجاد یک محتوای هدفمند این شکاف را پوشش می‌دهد.`, queryAngles: buildQueryAngles(topic, intent, course), recommendedLinks: buildRecommendedLinks(targetEntity, baseUrl) });
}
export function buildContentStrategyFromGaps(gaps = [], courses = [], siteUrl) { return gaps.flatMap((gap) => (gap.missingIntents || []).map((intent) => buildBrief({ ...gap, missingIntents: [intent] }, courses, siteUrl)).filter(Boolean)).sort((a, b) => b.priority - a.priority || a.topic.localeCompare(b.topic, "fa")); }
function buildCandidateBrief(candidate, courses = [], siteUrl) {
  const baseUrl = normalizeBaseUrl(siteUrl);
  const explicitCourse = candidate.relatedCourseSlug ? courses.find((item) => item?.slug === candidate.relatedCourseSlug) || null : null;
  const topic = resolveCandidateTopic(candidate, explicitCourse);
  if (!topic) return null;
  const course = explicitCourse || findCourseForTopic(topic, courses);
  const intent = candidate.intent || "informational";
  const isLocal = candidate.modifierType === "local_shushtar" || normalize(candidate.title).includes("شوشتر");
  const safeTopic = topic;
  const targetEntity = buildTargetEntity(safeTopic, course, isLocal, baseUrl);
  return Object.freeze({ source: "topic-engine", action: "NEW_CONTENT", topic: safeTopic.slug, topicName: safeTopic.name, searchIntent: intent, title: candidate.title, suggestedSlug: normalize(candidate.title).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 90), targetEntity, course: course ? Object.freeze({ slug: course.slug, title: course.title, url: `${baseUrl}/courses/${course.slug}` }) : null, priority: Math.max(0, Math.min(100, Number(candidate.scoreTotal) || 0)), articleCount: 0, existingArticleSlugs: [], rationale: candidate.reasoning || "این موضوع توسط موتور تولید موضوعات کشف و امتیازدهی شده است.", queryAngles: buildQueryAngles(safeTopic, intent, course), recommendedLinks: buildRecommendedLinks(targetEntity, baseUrl), modifierType: candidate.modifierType, scoreBreakdown: candidate.scoreBreakdown || null, topicId: candidate.id ?? null, topicStatus: candidate.status || null });
}
function opportunityKey(item) { return `${item.topic}|${item.searchIntent}|${item.course?.slug || item.targetEntity?.type || "general"}`; }
function mergeOpportunity(candidate, gap, siteUrl) {
  const topic = findTopic(candidate.topic);
  if (!topic) return null;
  const baseUrl = normalizeBaseUrl(siteUrl);
  const priority = Math.min(100, Math.round(Math.max(candidate.priority, gap.priority) + Math.min(10, Math.abs(candidate.priority - gap.priority) * 0.15)));
  const course = candidate.course?.slug ? { slug: candidate.course.slug, title: candidate.course.title } : null;
  const searchIntent = gap.searchIntent || candidate.searchIntent;
  const isLocal = searchIntent === "local";
  const targetEntity = buildTargetEntity(topic, course ? coursesForMergeCourse(course, baseUrl) : null, isLocal, baseUrl);
  return Object.freeze({ ...candidate, source: "topic-engine+gap", priority, gapDetected: true, gapPriority: gap.priority, gapArticleCount: gap.articleCount, existingArticleSlugs: gap.existingArticleSlugs, action: gap.articleCount > 0 ? "OPTIMIZE_EXISTING" : "NEW_CONTENT", searchIntent, queryAngles: buildQueryAngles(topic, searchIntent, course), targetEntity, rationale: `${candidate.rationale} تحلیل SEO/GEO نیز این Intent را کم‌پوشش تشخیص داده است: ${gap.rationale}` });
}
function coursesForMergeCourse(course, baseUrl) { return course ? { slug: course.slug, title: course.title } : null; }
export function buildUnifiedContentOpportunities({ gaps = [], topicCandidates = [], courses = [], siteUrl } = {}) {
  const byKey = new Map();
  for (const candidate of topicCandidates) { if (!candidate?.title) continue; const item = buildCandidateBrief(candidate, courses, siteUrl); if (!item) continue; const key = opportunityKey(item); const previous = byKey.get(key); if (!previous || item.priority > previous.priority) byKey.set(key, item); }
  for (const gap of buildContentStrategyFromGaps(gaps, courses, siteUrl)) { const key = opportunityKey(gap), candidate = byKey.get(key); const merged = candidate ? mergeOpportunity(candidate, gap, siteUrl) : null; byKey.set(key, merged || gap); }
  const opportunities = [...byKey.values()].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "fa"));
  return Object.freeze({ opportunityCount: opportunities.length, highPriorityCount: opportunities.filter((item) => item.priority >= 85).length, newContentCount: opportunities.filter((item) => item.action === "NEW_CONTENT").length, optimizeCount: opportunities.filter((item) => item.action === "OPTIMIZE_EXISTING").length, mergeCount: opportunities.filter((item) => item.action === "MERGE_CONTENT").length, opportunities: Object.freeze(opportunities) });
}
export function buildContentStrategy(gaps = [], courses = [], { siteUrl } = {}) { const briefs = buildContentStrategyFromGaps(gaps, courses, siteUrl); return Object.freeze({ briefCount: briefs.length, highPriorityCount: briefs.filter((item) => item.priority >= 85).length, briefs: Object.freeze(briefs) }); }
