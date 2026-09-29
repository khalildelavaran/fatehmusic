/**
 * Fateh Music Academy — Content Cluster Engine
 * Deterministic topical clustering for published blog content.
 */
import { TOPICS, resolveTopics } from "./topics.js";
import { containsSemanticPhrase, normalizeSemanticText } from "../helpers/text.js";
import { classifyIntent } from "./intents.js";
import { buildContentStrategy } from "./content-strategy.js";

function normalize(value) { return normalizeSemanticText(value); }
function hasLocalSignal(...values) { return values.some((value) => containsSemanticPhrase(value || "", "شوشتر")); }

function findDeclaredTopic(value) {
  const normalized = normalize(value);
  if (!normalized) return null;
  return TOPICS.find((topic) => topic.slug === normalized || normalize(topic.name) === normalized || (topic.aliases || []).some((alias) => normalize(alias) === normalized)) || null;
}

function findCourseTopic(courseSlug) {
  const normalized = normalize(courseSlug);
  if (!normalized) return null;
  const directSlug = normalized.endsWith("-course") ? normalized.slice(0, -7) : normalized;
  return TOPICS.find((topic) => topic.slug === directSlug && topic.slug !== "music-education" && topic.slug !== "shushtar") || null;
}

function resolveProfileSubjects(post, resolvedTopics) {
  const declaredTopic = findDeclaredTopic(post.topic);
  if (declaredTopic && declaredTopic.slug !== "music-education" && declaredTopic.slug !== "shushtar") return [declaredTopic];

  const courseTopic = findCourseTopic(post.related_course_slug);
  if (courseTopic) return [courseTopic];

  return resolvedTopics.filter((topic) => topic.slug !== "shushtar" && topic.slug !== "music-education");
}

function profile(post) {
  const keywords = [post.topic, post.title, post.excerpt].filter(Boolean);
  const topics = resolveTopics({ title: post.title, keywords, path: `/blog/${post.slug}` });
  const local = hasLocalSignal(post.topic, post.title, post.excerpt) || topics.some((topic) => topic.slug === "shushtar");
  const subjectTopics = resolveProfileSubjects(post, topics);
  const fallbackTopics = topics.filter((topic) => topic.slug !== "shushtar");
  const finalTopics = subjectTopics.length ? subjectTopics : fallbackTopics;
  return Object.freeze({ slug: post.slug, title: post.title, topics: finalTopics.length ? finalTopics.map((item) => item.slug) : ["music-education"], topicDetails: finalTopics.length ? finalTopics : topics, scope: local ? "shushtar" : "global", intent: classifyIntent({ path: `/blog/${post.slug}`, title: post.title, keywords, entityType: "Article" }).primary, relatedCourseSlug: post.related_course_slug || null });
}

export function buildArticleProfiles(posts = []) { return posts.filter((post) => post?.slug && post?.title).map(profile); }

export function scoreArticleRelation(source, target) {
  if (!source || !target || source.slug === target.slug) return 0;
  const sharedTopics = (source.topics || []).filter((topic) => (target.topics || []).includes(topic));
  let score = sharedTopics.length * 35;
  if (source.scope === target.scope) score += 8;
  if (source.intent === target.intent) score += 8;
  if (source.relatedCourseSlug && source.relatedCourseSlug === target.relatedCourseSlug) score += 18;
  return score;
}

export function buildArticleClusterLinks(posts = [], limit = 4) {
  const profiles = buildArticleProfiles(posts);
  const topicIndex = new Map();
  const scopeIntentIndex = new Map();
  const courseIndex = new Map();

  const addToIndex = (index, key, profile) => {
    if (!key) return;
    const bucket = index.get(key) || [];
    bucket.push(profile);
    index.set(key, bucket);
  };

  for (const profile of profiles) {
    for (const topic of profile.topics || []) {
      addToIndex(topicIndex, String(topic), profile);
    }
    addToIndex(scopeIntentIndex, String(profile.scope || "") + "|" + String(profile.intent || ""), profile);
    if (profile.relatedCourseSlug) addToIndex(courseIndex, String(profile.relatedCourseSlug), profile);
  }

  const safeLimit = Math.max(0, Number(limit) || 4);

  return profiles.map((source) => {
    const candidates = new Map();
    for (const topic of source.topics || []) {
      for (const profile of topicIndex.get(String(topic)) || []) {
        if (profile.slug !== source.slug) candidates.set(profile.slug, profile);
      }
    }

    const scopeIntentKey = String(source.scope || "") + "|" + String(source.intent || "");
    for (const profile of scopeIntentIndex.get(scopeIntentKey) || []) {
      if (profile.slug !== source.slug) candidates.set(profile.slug, profile);
    }

    if (source.relatedCourseSlug) {
      for (const profile of courseIndex.get(String(source.relatedCourseSlug)) || []) {
        if (profile.slug !== source.slug) candidates.set(profile.slug, profile);
      }
    }

    const related = [...candidates.values()]
      .map((target) => ({
        ...target,
        score: scoreArticleRelation(source, target),
        sharedTopics: (source.topics || []).filter((topic) => (target.topics || []).includes(topic))
      }))
      .filter((target) => target.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fa"))
      .slice(0, safeLimit);

    return { ...source, related };
  });
}

const DEFAULT_INTENTS = ["informational", "commercial", "transactional"];
const LOCAL_DEFAULT_INTENT = "local";
const CANONICAL_TOPIC = Object.freeze({ shushtar: "music-education" });
function canonicalTopic(topic) { return CANONICAL_TOPIC[topic] || topic; }

/**
 * A gap is a coverage state of a canonical asset: subject topic + geo scope +
 * optional course. Geography is metadata on the asset, not a competing topic.
 */
export function findContentGaps(posts = [], requiredIntents = DEFAULT_INTENTS, profilesOverride = null) {
  const profiles = Array.isArray(profilesOverride) ? profilesOverride : buildArticleProfiles(posts);
  const byAsset = new Map();

  for (const item of profiles) {
    const topics = item.topics.length ? item.topics : ["music-education"];
    for (const topic of topics) {
      const canonical = canonicalTopic(topic);
      const subject = topic === "music-education" ? "music-education" : topic;
      const key = `${canonical}|${item.scope}|${item.relatedCourseSlug || "general"}`;
      const entry = byAsset.get(key) || { topic: subject, canonicalTopic: canonical, scope: item.scope, courseSlug: item.relatedCourseSlug || null, intents: new Set(), articles: [] };
      entry.intents.add(item.intent);
      entry.articles.push(item.slug);
      byAsset.set(key, entry);
    }
  }

  return [...byAsset.values()].map((entry) => {
    const scopedRequiredIntents =
      requiredIntents === DEFAULT_INTENTS && entry.scope === "shushtar"
        ? [...requiredIntents, LOCAL_DEFAULT_INTENT]
        : requiredIntents;

    return {
      topic: entry.topic,
      canonicalTopic: entry.canonicalTopic,
      scope: entry.scope,
      courseSlug: entry.courseSlug,
      coveredIntents: [...entry.intents],
      missingIntents: scopedRequiredIntents.filter((intent) => !entry.intents.has(intent)),
      articleCount: entry.articles.length,
      articleSlugs: [...new Set(entry.articles)]
    };
  }).filter((gap) => gap.missingIntents.length > 0)
    .sort((a, b) => b.missingIntents.length - a.missingIntents.length || a.articleCount - b.articleCount || a.topic.localeCompare(b.topic, "fa"));
}

export function buildContentClusterReport(posts = [], {
  courses = [],
  siteUrl,
  includeLinks = true,
  includeStrategy = true
} = {}) {
  const profiles = buildArticleProfiles(posts);
  const topics = [...new Set(profiles.flatMap((item) => item.topics))];
  const gaps = findContentGaps(posts, DEFAULT_INTENTS, profiles);
  return Object.freeze({
    articleCount: profiles.length,
    topicCount: topics.length,
    topics,
    profiles,
    links: includeLinks ? buildArticleClusterLinks(posts) : [],
    gaps,
    strategy: includeStrategy ? buildContentStrategy(gaps, courses, { siteUrl }) : []
  });
}

export function buildArticleLinkCandidates(posts = [], siteUrl) {
  const base = String(siteUrl || "").replace(/\/$/, "");
  return posts.filter((post) => post?.slug && post?.title).map((post) => {
    const keywords = [post.topic, post.title, post.excerpt].filter(Boolean);
    const topics = resolveTopics({ title: post.title, keywords, path: `/blog/${post.slug}` });
    const local = hasLocalSignal(post.topic, post.title, post.excerpt) || topics.some((topic) => topic.slug === "shushtar");
    const profileTopics = resolveProfileSubjects(post, topics);
    return { url: `${base}/blog/${encodeURIComponent(post.slug)}`, title: post.title, type: "Article", topics: (profileTopics.length ? profileTopics : topics.filter((topic) => topic.slug !== "shushtar")).map((item) => item.slug), topicDetails: profileTopics.length ? profileTopics : topics, intent: classifyIntent({ path: `/blog/${post.slug}`, title: post.title, keywords, entityType: "Article" }).primary, priority: 12, local };
  });
}
