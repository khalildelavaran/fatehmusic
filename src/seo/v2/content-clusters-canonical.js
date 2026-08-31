/** Canonical semantic adapter for article clustering. */
import { resolveTopics } from "./topics.js";

export function resolveArticleTopics(post = {}) {
  return resolveTopics({
    title: post.title,
    keywords: [post.topic, post.excerpt].filter(Boolean),
    path: `/blog/${post.slug || ""}`
  }).map((topic) => topic.slug);
}
