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
export function findContentGaps(posts = [], requiredIntents = DEFAULT_INTENTS) {
  const profiles = buildArticleProfiles(posts);
  const byTopic = new Map();
  for (const item of profiles) for (const topic of item.topics) {
    const entry = byTopic.get(topic) || { topic, intents: new Set(), articles: [] };
    entry.intents.add(item.intent); entry.articles.push(item.slug); byTopic.set(topic, entry);
  }
  return [...byTopic.values()].map((entry) => ({ topic: entry.topic, coveredIntents: [...entry.intents], missingIntents: requiredIntents.filter((intent) => !entry.intents.has(intent)), articleCount: entry.articles.length, articleSlugs: entry.articles })).sort((a, b) => b.missingIntents.length - a.missingIntents.length || a.articleCount - b.articleCount);
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
  return posts.filter((post) => post?.slug && post?.title).map((post) => ({ url: `${base}/blog/${encodeURIComponent(post.slug)}`, title: post.title, type: "Article", topics: [post.topic, post.title, post.excerpt].filter(Boolean), priority: 12, local: true }));
}
