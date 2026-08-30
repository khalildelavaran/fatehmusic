/**
 * Fateh Music Academy — Content Cluster Engine
 * Groups published Articles by canonical topics, scores article-to-article
 * relevance, identifies missing intent coverage, and produces hub links.
 */
import { resolveTopics } from "./topics.js";
import { classifyIntent } from "./intents.js";

function normalize(value = "") {
  return String(value)
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\u200c]/g, "")
    .toLowerCase();
}

function articleProfile(post) {
  const keywords = [post.topic, post.title, post.excerpt].filter(Boolean);
  const topics = resolveTopics({
    title: post.title,
    keywords,
    path: `/blog/${post.slug}`
  });
  const intent = classifyIntent({
    path: `/blog/${post.slug}`,
    title: post.title,
    keywords,
    entityType: "Article"
  });

  return Object.freeze({
    slug: post.slug,
    title: post.title,
    topics: topics.map((topic) => topic.slug),
    intent: intent.primary,
    relatedCourseSlug: post.related_course_slug || null
  });
}

export function buildArticleProfiles(posts = []) {
  return posts.filter((post) => post?.slug && post?.title).map(articleProfile);
}

export function scoreArticleRelation(source, target) {
  if (!source || !target || source.slug === target.slug) return 0;
  const sharedTopics = (source.topics || []).filter((topic) => (target.topics || []).includes(topic));
  let score = sharedTopics.length * 35;
  if (source.intent === target.intent) score += 8;
  if (source.relatedCourseSlug && source.relatedCourseSlug === target.relatedCourseSlug) score += 18;
  if (target.relatedCourseSlug && !source.relatedCourseSlug) score += 5;
  return score;
}

export function buildArticleClusterLinks(posts = [], limit = 4) {
  const profiles = buildArticleProfiles(posts);

  return profiles.map((source) => ({
    ...source,
    related: profiles
      .filter((target) => target.slug !== source.slug)
      .map((target) => ({
        ...target,
        score: scoreArticleRelation(source, target),
        sharedTopics: source.topics.filter((topic) => target.topics.includes(topic))
      }))
      .filter((target) => target.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fa"))
      .slice(0, Math.max(0, limit))
  }));
}

const REQUIRED_INTENTS = ["informational", "commercial", "transactional", "local"];

/**
 * Reports topic coverage gaps. A gap means a topic has content but lacks
 * one or more high-value search intents, or has no article at all.
 */
export function findContentGaps(posts = [], requiredIntents = REQUIRED_INTENTS) {
  const profiles = buildArticleProfiles(posts);
  const byTopic = new Map();

  for (const profile of profiles) {
    for (const topic of profile.topics) {
      const current = byTopic.get(topic) || { topic, intents: new Set(), articles: [] };
      current.intents.add(profile.intent);
      current.articles.push(profile.slug);
      byTopic.set(topic, current);
    }
  }

  return [...byTopic.values()]
    .map((entry) => ({
      topic: entry.topic,
      coveredIntents: [...entry.intents],
      missingIntents: requiredIntents.filter((intent) => !entry.intents.has(intent)),
      articleCount: entry.articles.length,
      articleSlugs: entry.articles
    }))
    .sort((a, b) => b.missingIntents.length - a.missingIntents.length || a.articleCount - b.articleCount);
}

export function buildContentClusterReport(posts = []) {
  const profiles = buildArticleProfiles(posts);
  const links = buildArticleClusterLinks(posts);
  const gaps = findContentGaps(posts);
  const topics = [...new Set(profiles.flatMap((profile) => profile.topics))];

  return Object.freeze({
    articleCount: profiles.length,
    topicCount: topics.length,
    topics,
    profiles,
    links,
    gaps
  });
}

/**
 * Returns only public article candidate nodes for the global link graph.
 */
export function buildArticleLinkCandidates(posts = [], siteUrl) {
  return posts.filter((post) => post?.slug && post?.title).map((post) => ({
    url: `${String(siteUrl).replace(/\/$/, "")}/blog/${encodeURIComponent(post.slug)}`,
    title: post.title,
    type: "Article",
    topics: [post.topic, post.title, post.excerpt].filter(Boolean),
    priority: 12,
    local: true
  }));
}

export function semanticText(post) {
  return normalize([post?.title, post?.topic, post?.excerpt, post?.content].filter(Boolean).join(" "));
}
