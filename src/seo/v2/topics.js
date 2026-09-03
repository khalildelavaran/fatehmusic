/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Topic taxonomy and deterministic topic resolution.
 * --------------------------------------------------------
 */

import { clean, stripZwnj } from "../helpers/text.js";

export const TOPICS = Object.freeze([
    { slug: "music-education", name: "آموزش موسیقی", aliases: ["آموزش موسیقی", "کلاس موسیقی", "یادگیری موسیقی"] },
    { slug: "guitar", name: "گیتار", aliases: ["گیتار", "آموزش گیتار", "کلاس گیتار"] },
    { slug: "piano", name: "پیانو", aliases: ["پیانو", "آموزش پیانو", "کلاس پیانو"] },
    { slug: "violin", name: "ویولن", aliases: ["ویولن", "آموزش ویولن", "کلاس ویولن"] },
    { slug: "kamancheh", name: "کمانچه", aliases: ["کمانچه", "آموزش کمانچه"] },
    { slug: "tar", name: "تار", aliases: ["تار", "آموزش تار"] },
    { slug: "setar", name: "سه‌تار", aliases: ["سه‌تار", "سه تار", "آموزش سه‌تار", "آموزش سه تار"] },
    { slug: "santur", name: "سنتور", aliases: ["سنتور", "آموزش سنتور"] },
    { slug: "keyboard", name: "ارگ و کیبورد", aliases: ["ارگ", "کیبورد", "ارگ و کیبورد", "آموزش ارگ", "آموزش کیبورد"] },
    { slug: "daf", name: "دف", aliases: ["دف", "آموزش دف"] },
    { slug: "tombak", name: "تنبک", aliases: ["تنبک", "آموزش تنبک"] },
    { slug: "ney", name: "نی", aliases: ["نی", "آموزش نی"] },
    { slug: "neyanban", name: "نی‌انبان", aliases: ["نی‌انبان", "نی انبان", "نیانبان"] },
    { slug: "vocal", name: "آواز", aliases: ["آواز", "آواز پاپ", "آواز سنتی", "صداسازی", "خوانندگی"] },
    { slug: "solfege", name: "سلفژ", aliases: ["سلفژ", "نت‌خوانی", "نت خوانی"] },
    { slug: "music-theory", name: "تئوری موسیقی", aliases: ["تئوری موسیقی", "تئوری"] },
    { slug: "rhythm", name: "ریتم و وزن‌خوانی", aliases: ["ریتم", "وزن‌خوانی", "وزن خوانی", "ریتم و وزن"] },
    { slug: "children-music", name: "موسیقی کودک", aliases: ["موسیقی کودک", "آموزش موسیقی کودک"] },
    { slug: "shushtar", name: "آموزش موسیقی در شوشتر", aliases: ["شوشتر", "موسیقی شوشتر", "آموزش موسیقی شوشتر", "کلاس موسیقی شوشتر"] }
]);

const PARENT_TOPIC = "music-education";
const LOCAL_TOPIC = "shushtar";

function normalize(value) {
    return stripZwnj(clean(value)).replace(/[يى]/g, "ی").replace(/[ك]/g, "ک").toLowerCase();
}

function resolveTopicMatches(corpus) {
    return TOPICS
        .map((topic) => {
            const matches = topic.aliases.filter((alias) => corpus.includes(normalize(alias)));
            return {
                ...topic,
                score: matches.length ? Math.min(95, 35 + matches.length * 20) : 0,
                matchedBy: matches
            };
        })
        .filter((topic) => topic.score > 0);
}

function suppressParentTopics(topics) {
    const hasSpecificTopic = topics.some((topic) => topic.slug !== PARENT_TOPIC);
    if (!hasSpecificTopic) return topics;
    return topics.filter((topic) => topic.slug !== PARENT_TOPIC);
}

function applyTopicPrecedence(topics) {
    // Local scope is a more specific semantic scope than the generic
    // "music-education" topic. A query such as "آموزش موسیقی در شوشتر"
    // must become one local asset, not two independent topic clusters.
    const hasLocalTopic = topics.some((topic) => topic.slug === LOCAL_TOPIC);
    const narrowed = hasLocalTopic ? topics.filter((topic) => topic.slug !== PARENT_TOPIC) : topics;
    return suppressParentTopics(narrowed);
}

/**
 * Resolve high-confidence topics from visible page semantics.
 * @param {{title?:string, keywords?:string[], path?:string, explicit?:string[]}} input
 */
export function resolveTopics({ title = "", keywords = [], path = "", explicit = [] } = {}) {
    const corpus = normalize([title, path, ...(keywords || [])].join(" | "));
    const explicitSet = new Set((explicit || []).map(normalize));

    const resolved = TOPICS
        .map((topic) => {
            const explicitMatch = explicitSet.has(topic.slug) || explicitSet.has(normalize(topic.name));
            const matches = topic.aliases.filter((alias) => corpus.includes(normalize(alias)));
            const score = explicitMatch ? 100 : matches.length ? Math.min(95, 35 + matches.length * 20) : 0;
            return {
                ...topic,
                score,
                matchedBy: explicitMatch ? [topic.slug] : matches
            };
        })
        .filter((topic) => topic.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fa"));

    return applyTopicPrecedence(resolved).slice(0, 8);
}

/**
 * Return stable topic slugs only.
 */
export function topicSlugs(input) {
    return resolveTopics(input).map((topic) => topic.slug);
}
