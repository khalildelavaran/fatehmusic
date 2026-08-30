/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Deterministic search-intent classifier.
 * --------------------------------------------------------
 */

import { clean, stripZwnj } from "../helpers/text.js";

const RULES = [
    { intent: "transactional", weight: 70, tokens: ["ثبت نام", "ثبت‌نام", "قیمت", "هزینه", "رزرو", "خرید"] },
    { intent: "local", weight: 65, tokens: ["شوشتر", "خوزستان", "نزدیک", "حضوری"] },
    { intent: "informational", weight: 45, tokens: ["چیست", "چگونه", "چطور", "راهنما", "آموزش", "سرفصل", "تفاوت", "اشتباهات"] },
    { intent: "commercial", weight: 40, tokens: ["بهترین", "مناسب", "مقایسه", "انتخاب"] },
    { intent: "navigational", weight: 35, tokens: ["درباره", "تماس", "آموزشگاه موسیقی فاتح", "فاتح"] }
];

function normalize(value) {
    return stripZwnj(clean(value)).replace(/[يى]/g, "ی").replace(/[ك]/g, "ک").toLowerCase();
}

/**
 * @param {{path?:string,title?:string,keywords?:string[],entityType?:string}} input
 * @returns {{primary:string, intents:{intent:string,score:number,reason:string[]}[]}}
 */
export function classifyIntent({ path = "", title = "", keywords = [], entityType = "" } = {}) {
    const corpus = normalize([path, title, ...(keywords || [])].join(" | "));
    const scores = new Map();

    for (const rule of RULES) {
        const matches = rule.tokens.filter((token) => corpus.includes(normalize(token)));
        if (matches.length) scores.set(rule.intent, { score: rule.weight + matches.length * 10, reason: matches });
    }

    if (normalize(path).startsWith("/blog")) add(scores, "informational", 25, ["blog"]);
    if (normalize(path).startsWith("/courses")) add(scores, "commercial", 20, ["course-path"]);
    if (normalize(path).startsWith("/register")) add(scores, "transactional", 45, ["register-path"]);
    if (normalize(path).startsWith("/contact")) add(scores, "navigational", 30, ["contact-path"]);
    if (normalize(path).startsWith("/instructors")) add(scores, "navigational", 20, ["instructor-path"]);
    if (entityType === "Course") add(scores, "commercial", 15, ["course-entity"]);
    if (entityType === "Article") add(scores, "informational", 20, ["article-entity"]);

    const intents = [...scores.entries()]
        .map(([intent, value]) => ({ intent, ...value }))
        .sort((a, b) => b.score - a.score || a.intent.localeCompare(b.intent));

    if (!intents.length) intents.push({ intent: "informational", score: 20, reason: ["default"] });

    return Object.freeze({ primary: intents[0].intent, intents });
}

function add(map, intent, weight, reason) {
    const current = map.get(intent) || { score: 0, reason: [] };
    current.score += weight;
    current.reason.push(...reason);
    map.set(intent, current);
}
