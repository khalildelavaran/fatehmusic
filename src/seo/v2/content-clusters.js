/**
 * Fateh Music Academy — Content Cluster Engine
 * Deterministic topical clustering for published blog content.
 */
import { resolveTopics } from "./topics.js";
import { classifyIntent } from "./intents.js";
import { buildContentStrategy } from "./content-strategy.js";

function profile(post) {
  const keywords = [post.topic, post.title, post.excerpt].filter(Boolean);
  const topics = resolveTopics({ title: post.title, keywords, path: `/blog/${post.slug}` });
  const intent = classifyIntent({ path: `/blog/${post.slug}`, title: post.title, keywords, entityType: "Article" });
  return Object.freeze({ slug: post.slug, title: post.title, topics: topics.map((item) => item.slug), intent: intent.primary, relatedCourseSlug: post.related_course_slug || null });
}

export function buildArticleProfiles(posts = []) { return posts.filter((post) => post?.slug && post?.title).map(profile); }

export function scoreArticleRelation(source, target) {
  if (!source || !target || source.slug === target.slug) return 0;
  const sharedTopics = (source.topics || []).filter((topic) => (target.topics || []).includes(topic));
  let score = sharedTopics.length * 35;
  if (source.intent === target.intent) score += 8;
  if (source.relatedCourseSlug && source.relatedCourseSlug === target.relatedCourseSlug) score += 18;
  return score;
}

export function buildArticleClusterLinks(posts = [], limit = 4) {
  const profiles = buildArticleProfiles(posts);
  return profiles.map((source) => ({ ...source, related: profiles.filter((target) => target.slug !== source.slug).map((target) => ({ ...target, score: scoreArticleRelation(source, target), sharedTopics: source.topics.filter((topic) => target.topics.includes(topic)) })).filter((target) => target.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fa")).slice(0, Math.max(0, limit)) }));
}

const DEFAULT_INTENTS = ["informational", "commercial", "transactional", "local"];
const INTENT_SCOPE = Object.freeze({ local: "shushtar", commercial: "global", transactional: "global", informational: "global" });
const CANONICAL_TOPIC = Object.freeze({ shushtar: "music-education" });

function canonicalTopic(topic) { return CANONICAL_TOPIC[topic] || topic; }
function canonicalCourse(items) {
  const courses = [...new Set(items.map((item) => item?.relatedCourseSlug).filter(Boolean))];
  return courses.length === 1 ? courses[0] : null;
}

/**
 * Gaps are search-coverage records, not articles. Compatible intents for the
 * same topic/scope/course are aggregated into one canonical asset so the UI
 * cannot generate one opportunity per intent.
 */
export function findContentGaps(posts = [], requiredIntents = DEFAULT_INTENTS) {
  const profiles = buildArticleProfiles(posts);
  const byAsset = new Map();
  for (const item of profiles) for (const topic of item.topics) {
    const coveredIntent = item.intent;
    const canonical = canonicalTopic(topic);
    const isLocal = topic === "shushtar";
    const scope = isLocal ? "shushtar" : "global";
    const key = `${canonical}|${scope}|${item.relatedCourseSlug || "general"}`;
    const entry = byAsset.get(key) || { topic: topic === "shushtar" ? "shushtar" : topic, canonicalTopic: canonical, scope, courseCandidates: [], intents: new Set(), articles: [] };
    entry.intents.add(coveredIntent);
    if (item.relatedCourseSlug) entry.courseCandidates.push(item.relatedCourseSlug);
    entry.articles.push(item.slug);
    byAsset.set(key, entry);
  }

  const gaps = [...byAsset.values()].map((entry) => {
    const courseSlug = canonicalCourse(entry.courseCandidates.map((slug) => ({ relatedCourseSlug: slug })));
    const missingIntents = requiredIntents.filter((intent) => !entry.intents.has(intent));
    return {
      topic: entry.topic,
      canonicalTopic: entry.canonicalTopic,
      scope: entry.scope,
      courseSlug,
      coveredIntents: [...entry.intents],
      missingIntents,
      articleCount: entry.articles.length,
      articleSlugs: [...new Set(entry.articles)]
    };
  }).filter((gap) => gap.missingIntents.length > 0);

  return gaps.sort((a, b) => b.missingIntents.length - a.missingIntents.length || a.articleCount - b.articleCount || a.topic.localeCompare(b.topic, "fa"));
}

export function buildContentClusterReport(posts = [], { courses = [], siteUrl } = {}) {
  const profiles = buildArticleProfiles(posts);
  const topics = [...new Set(profiles.flatMap((item) => item.topics))];
  const gaps = findContentGaps(posts);
  return Object.freeze({
    articleCount: profiles.length,
    topicCount: topics.length,
    topics,
    profiles,
    links: buildArticleClusterLinks(posts),
    gaps,
    strategy: buildContentStrategy(gaps, courses, { siteUrl })
  });
}

export function buildArticleLinkCandidates(posts = [], siteUrl) {
  const base = String(siteUrl || "").replace(/\/$/, "");
  return posts.filter((post) => post?.slug && post?.title).map((post) => {
    const keywords = [post.topic, post.title, post.excerpt].filter(Boolean);
    const topics = resolveTopics({ title: post.title, keywords, path: `/blog/${post.slug}` });
    const intent = classifyIntent({ path: `/blog/${post.slug}`, title: post.title, keywords, entityType: "Article" });
    return {
      url: `${base}/blog/${encodeURIComponent(post.slug)}`,
      title: post.title,
      type: "Article",
      topics: topics.map((item) => item.slug),
      topicDetails: topics,
      intent: intent.primary,
      priority: 12,
      local: true
    };
  });
}
