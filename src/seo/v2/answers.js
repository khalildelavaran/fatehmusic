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
