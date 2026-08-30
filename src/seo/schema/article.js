/**
 * Fateh Music Academy — Article Entity Schema
 * ------------------------------------------------------------
 */
import { SCHEMA_TYPES } from "../config/constants.js";
import { absoluteUrl } from "../helpers/url.js";
import { articleEntityId, courseEntityId, instructorEntityId } from "../geo/entity.js";

export function buildArticleSchema(post, { site, url, keywords = [], topics = [] }) {
    const publishedAt = post.published_at || post.created_at;
    const modifiedAt = post.updated_at || post.modified_at || publishedAt;
    const description = post.meta_description || post.excerpt || post.title;
    const image = absoluteUrl(post.image || post.cover_image || post.featured_image || site.image, site.url);
    const topicRefs = topics.map((topic) => ({ "@id": `${site.url}/#topic-${topic.slug}` }));

    const schema = {
        "@type": SCHEMA_TYPES.ARTICLE,
        "@id": articleEntityId(url),
        url,
        headline: post.title,
        description,
        image,
        datePublished: toIsoDate(publishedAt),
        dateModified: toIsoDate(modifiedAt),
        inLanguage: "fa-IR",
        articleSection: post.topic,
        keywords,
        author: resolveAuthor(post),
        publisher: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@id": `${url}/#webpage` },
        isPartOf: { "@id": `${site.url}/#website` },
        about: post.related_course_slug
            ? { "@id": courseEntityId(absoluteUrl(`/courses/${post.related_course_slug}`, site.url)) }
            : topicRefs[0],
        mentions: topicRefs.length ? topicRefs : undefined
    };

    if (post.content) schema.wordCount = countWords(post.content);
    return pruneEmpty(schema);
}

function resolveAuthor(post) {
    if (post.author_url && post.author_name) {
        return {
            "@type": SCHEMA_TYPES.PERSON,
            "@id": post.author_url.endsWith("#person") ? post.author_url : instructorEntityId(post.author_url),
            name: post.author_name
        };
    }
    if (post.author_name) return { "@type": SCHEMA_TYPES.PERSON, name: post.author_name };
    return undefined;
}

function toIsoDate(value) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function countWords(value) {
    return value.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function pruneEmpty(node) {
    return Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined && value !== null));
}
