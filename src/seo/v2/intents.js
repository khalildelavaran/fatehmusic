/**
 * Fateh Music Academy — unified search intent engine.
 * Title semantics are shared with the content engine; V2 adds contextual
 * path/entity/local evidence without duplicating title rules.
 */

import { containsSemanticPhrase, normalizeSemanticText } from "../helpers/text.js";

const TITLE_RULES = Object.freeze([
    { intent: "transactional", weight: 70, tokens: ["ثبت‌نام", "ثبت نام", "قیمت", "هزینه", "شهریه", "تعرفه", "رزرو", "خرید"] },
    { intent: "local", weight: 65, tokens: ["شوشتر", "خوزستان", "نزدیک", "حضوری"] },
    { intent: "informational", weight: 45, tokens: ["چیست", "چگونه", "چطور", "راهنما", "آموزش", "سرفصل", "اشتباهات"] },
    { intent: "commercial", weight: 40, tokens: ["بهترین", "مناسب", "مقایسه", "تفاوت", "انتخاب", "کدام را انتخاب", "راهنمای خرید"] },
    { intent: "navigational", weight: 35, tokens: ["درباره", "تماس", "آموزشگاه موسیقی فاتح", "آموزشگاه فاتح", "فاتح", "فاتح موزیک"] }
]);

function normalize(value) { return normalizeSemanticText(value); }

function scoreTitleIntents(title = "") {
    const corpus = normalize(title);
    const scores = new Map();

    for (const rule of TITLE_RULES) {
        const matches = rule.tokens.filter((token) => containsSemanticPhrase(corpus, token));
        if (!matches.length) continue;
        const current = scores.get(rule.intent) || { score: 0, reason: [] };
        current.score += rule.weight + matches.length * 10;
        current.reason.push(...matches);
        scores.set(rule.intent, current);
    }

    return [...scores.entries()]
        .map(([intent, value]) => ({ intent, ...value }))
        .sort((a, b) => b.score - a.score || a.intent.localeCompare(b.intent));
}

/**
 * Title-only classifier shared with the AI content-engine.
 */
export function classifyTitleIntent(title = "") {
    const intents = scoreTitleIntents(title);
    if (!intents.length) {
        return Object.freeze({
            primary: "informational",
            confidence: 0.65,
            matches: Object.freeze([]),
            intents: Object.freeze([])
        });
    }

    const top = intents[0];
    const second = intents[1]?.score || 0;
    const gap = Math.max(0, top.score - second);
    const confidence = intents.length === 1
        ? Math.min(0.99, Math.max(0.35, top.score / 100))
        : Math.min(0.99, Math.max(0.35, 0.55 + gap / 100));

    return Object.freeze({
        primary: top.intent,
        confidence: Number(confidence.toFixed(3)),
        matches: Object.freeze([...(top.reason || [])]),
        intents: Object.freeze(intents)
    });
}

/**
 * @param {{path?:string,title?:string,keywords?:string[],entityType?:string}} input
 * @returns {{primary:string,confidence:number,intents:{intent:string,score:number,reason:string[]}[]}}
 */
export function classifyIntent({ path = "", title = "", keywords = [], entityType = "" } = {}) {
    const titleResult = classifyTitleIntent(title);
    const scores = new Map(
        (titleResult.intents || []).map((item) => [
            item.intent,
            { score: item.score, reason: [...(item.reason || [])] }
        ])
    );

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

    const topScore = Number(intents[0]?.score || 0);
    const secondScore = Number(intents[1]?.score || 0);
    const scoreGap = Math.max(0, topScore - secondScore);
    const confidence = intents.length === 1
        ? Math.min(1, Math.max(0.35, topScore / 100))
        : Math.min(0.99, Math.max(0.35, 0.55 + scoreGap / 100));

    return Object.freeze({
        primary: intents[0].intent,
        confidence: Number(confidence.toFixed(3)),
        intents
    });
}

function add(map, intent, weight, reason) {
    const current = map.get(intent) || { score: 0, reason: [] };
    current.score += weight;
    current.reason.push(...reason);
    map.set(intent, current);
}
