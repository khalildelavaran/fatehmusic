/**
 * FAQ structured data builder.
 * Mirrors the FAQ content rendered visibly on the page.
 */

/**
 * @param {{question:string,answer:string}[]} faqs
 * @param {{site:{url:string}, url:string, name?:string}} options
 */
export function buildFaqSchema(faqs = [], { site, url, name = "سوالات متداول" } = {}) {
  const items = faqs
    .filter((item) => item?.question && item?.answer)
    .map((item, index) => ({
      "@type": "Question",
      "@id": `${String(url).replace(/\/$/, "")}#faq-${index + 1}`,
      name: String(item.question).trim(),
      acceptedAnswer: {
        "@type": "Answer",
        text: String(item.answer).trim()
      }
    }));

  if (!items.length) return null;

  return {
    "@type": "FAQPage",
    "@id": `${String(url).replace(/\/$/, "")}#faqpage`,
    url,
    name,
    inLanguage: "fa-IR",
    isPartOf: { "@id": `${site.url}/#website` },
    about: { "@id": `${site.url}/#organization` },
    mainEntity: items
  };
}
