/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Answer blocks: short, source-linked facts that can be reused
 * by templates, QA, and machine-readable outputs.
 * --------------------------------------------------------
 */

/**
 * @param {{question:string,answer:string,sourceUrl?:string,entityId?:string,priority?:number}[]} blocks
 */
export function buildAnswerBlocks(blocks = []) {
    return blocks
        .filter((block) => block?.question && block?.answer)
        .map((block, index) => Object.freeze({
            question: String(block.question).trim(),
            answer: String(block.answer).trim(),
            sourceUrl: block.sourceUrl,
            entityId: block.entityId,
            priority: Number.isFinite(block.priority) ? block.priority : index
        }))
        .sort((a, b) => a.priority - b.priority);
}

/**
 * Extract the strongest FAQ answers into concise GEO answer blocks.
 */
export function answersFromFaq(faqs = [], sourceUrl, entityId) {
    return buildAnswerBlocks(
        faqs.map((faq, index) => ({
            question: faq.question,
            answer: faq.answer,
            sourceUrl,
            entityId,
            priority: index
        }))
    );
}

/**
 * Extract concise GEO answer blocks directly from article Markdown.
 * Only question-like headings are eligible; no new facts are generated.
 *
 * @param {string} markdown
 * @param {string} sourceUrl
 * @param {string} [entityId]
 */
export function answersFromArticle(markdown = "", sourceUrl, entityId) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const blocks = [];

    for (let index = 0; index < lines.length; index += 1) {
        const heading = lines[index].match(/^#{2,4}\s+(.+?)\s*$/);
        if (!heading) continue;

        const question = heading[1].trim();
        const isQuestion = /[؟?]$/.test(question) || /^(آیا|چگونه|چرا|برای چه|چه زمانی|کدام|چطور)\b/.test(question);
        if (question.length < 12 || !isQuestion) continue;

        let answer = "";
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const line = lines[cursor].trim();
            if (!line) {
                if (answer) break;
                continue;
            }
            if (/^#{1,6}\s+/.test(line) || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) break;
            answer = answer ? answer + " " + line : line;
            if (answer.length >= 320) break;
        }

        if (answer.length >= 40) {
            blocks.push({ question, answer: answer.slice(0, 320), sourceUrl, entityId, priority: blocks.length });
        }
    }

    return buildAnswerBlocks(blocks).slice(0, 6);
}
