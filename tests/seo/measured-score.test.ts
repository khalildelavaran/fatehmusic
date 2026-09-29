import { describe, expect, it } from "vitest";
import {
  detectPageType,
  measureHtml,
  normalizeInternalHref,
  scorePage,
  scoreSite,
  DIMENSION_WEIGHTS
} from "../../src/seo/v2/measured-score.js";

const ld = (graph: object[]) =>
  `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph })}</script>`;

interface PageOpts {
  route?: string;
  title?: string;
  description?: string;
  robots?: string;
  canonical?: string;
  h1?: number;
  images?: string;
  schema?: object[];
  words?: number;
  links?: string[];
}

function page(opts: PageOpts = {}) {
  const route = opts.route ?? "/courses/piano-course";
  const canonical = opts.canonical ?? `https://fatehmusic.ir${route}`;
  const h1 = "<h1>عنوان</h1>".repeat(opts.h1 ?? 1);
  const filler = "کلمه ".repeat(opts.words ?? 600);
  const links = (opts.links ?? ["/a", "/b", "/c"]).map((l) => `<a href="${l}">x</a>`).join("");
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head>
<title>${opts.title ?? "آموزش پیانو در شوشتر | آموزشگاه موسیقی فاتح"}</title>
<meta name="description" content="${opts.description ?? "توضیح کامل و معتبر درباره دوره آموزش پیانو در آموزشگاه موسیقی فاتح شوشتر برای همه سطوح."}">
<meta name="robots" content="${opts.robots ?? "index,follow"}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="i"><meta property="og:url" content="u">
<meta name="twitter:card" content="summary_large_image">
${ld(
  opts.schema ?? [
    { "@type": "EducationalOrganization", "@id": "o" },
    { "@type": "WebSite", "@id": "w" },
    { "@type": "WebPage", "@id": "p" },
    { "@type": "Course", "@id": "c" },
    { "@type": "BreadcrumbList", "@id": "b" },
    { "@type": "FAQPage", "@id": "f" }
  ]
)}
</head><body>${h1}<h2>بخش</h2><p>${filler}</p>${opts.images ?? '<img src="/a.webp" alt="پیانو" width="10" height="10">'}${links}</body></html>`;
}

describe("detectPageType", () => {
  it.each([
    ["/", "home"],
    ["/courses", "listing"],
    ["/courses/piano-course", "course"],
    ["/instructors/reza-fateh", "instructor"],
    ["/locations/shushtar", "location"],
    ["/blog/some-post", "blog"],
    ["/register", "other"]
  ])("%s -> %s", (route, type) => {
    expect(detectPageType(route)).toBe(type);
  });
});

describe("normalizeInternalHref", () => {
  it("normalizes absolute, trailing-slash and fragment links", () => {
    expect(normalizeInternalHref("https://fatehmusic.ir/about/")).toBe("/about");
    expect(normalizeInternalHref("/courses#x")).toBe("/courses");
    expect(normalizeInternalHref("/")).toBe("/");
  });
  it("ignores external, protocol-relative and tel links", () => {
    expect(normalizeInternalHref("https://example.com/x")).toBeNull();
    expect(normalizeInternalHref("//cdn.example.com")).toBeNull();
    expect(normalizeInternalHref("tel:+98")).toBeNull();
  });
});

describe("weights", () => {
  it("sum to exactly 100", () => {
    expect(Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("scorePage", () => {
  const good = () => scorePage(measureHtml(page(), "/courses/piano-course"), { inboundCount: 5 });

  it("gives a fully compliant page 10 with no issues", () => {
    const result = good();
    expect(result.score).toBe(10);
    expect(result.issues).toEqual([]);
  });

  it("is deterministic", () => {
    expect(good()).toEqual(good());
  });

  it("treats a missing robots meta as indexable by default", () => {
    const html = page().replace(/<meta name="robots"[^>]*>/, "");
    const r = scorePage(measureHtml(html, "/courses/piano-course"), { inboundCount: 5 });
    expect(r.issues.map((i) => i.id)).not.toContain("indexable");
  });

  it("penalizes a noindex page and explains why", () => {
    const r = scorePage(measureHtml(page({ robots: "noindex,follow" }), "/courses/piano-course"), { inboundCount: 5 });
    expect(r.score).toBeLessThan(10);
    expect(r.issues.some((i) => i.id === "indexable")).toBe(true);
  });

  it("detects canonical that points to another URL", () => {
    const r = scorePage(measureHtml(page({ canonical: "https://fatehmusic.ir/other" }), "/courses/piano-course"), { inboundCount: 5 });
    expect(r.issues.map((i) => i.id)).toContain("canonical-matches-route");
  });

  it("detects duplicate and missing H1", () => {
    const two = scorePage(measureHtml(page({ h1: 2 }), "/courses/piano-course"), { inboundCount: 5 });
    const none = scorePage(measureHtml(page({ h1: 0 }), "/courses/piano-course"), { inboundCount: 5 });
    expect(two.issues.map((i) => i.id)).toContain("single-h1");
    expect(none.issues.map((i) => i.id)).toContain("single-h1");
  });

  it("detects images without alt and without dimensions", () => {
    const r = scorePage(measureHtml(page({ images: '<img src="/a.webp"><img src="/b.webp" alt="x">' }), "/courses/piano-course"), { inboundCount: 5 });
    const ids = r.issues.map((i) => i.id);
    expect(ids).toContain("alt-text");
    expect(ids).toContain("dimensions");
  });

  it("flags a lazy-loaded first image (LCP risk)", () => {
    const r = scorePage(measureHtml(page({ images: '<img src="/a.webp" alt="x" width="1" height="1" loading="lazy">' }), "/courses/piano-course"), { inboundCount: 5 });
    expect(r.issues.map((i) => i.id)).toContain("lcp-not-lazy");
  });

  it("flags thin content proportionally", () => {
    const r = scorePage(measureHtml(page({ words: 50 }), "/courses/piano-course"), { inboundCount: 5 });
    expect(r.issues.find((i) => i.id === "not-thin")?.lost).toBeGreaterThan(5);
  });

  it("flags a missing BreadcrumbList on an inner page but not on the home page", () => {
    const schema = [
      { "@type": "EducationalOrganization", "@id": "o" },
      { "@type": "WebSite", "@id": "w" },
      { "@type": "WebPage", "@id": "p" }
    ];
    const inner = scorePage(measureHtml(page({ route: "/gallery", schema, words: 200 }), "/gallery"), { inboundCount: 5 });
    expect(inner.issues.map((i) => i.id)).toContain("breadcrumb");
    const home = scorePage(measureHtml(page({ route: "/", schema, words: 400 }), "/"), { inboundCount: 0 });
    expect(home.issues.map((i) => i.id)).not.toContain("breadcrumb");
  });

  it("does not require FAQ markup on pages that should not have one", () => {
    const schema = [
      { "@type": "EducationalOrganization", "@id": "o" },
      { "@type": "WebPage", "@id": "p" },
      { "@type": "BreadcrumbList", "@id": "b" },
      { "@type": "ImageGallery", "@id": "g" }
    ];
    const r = scorePage(measureHtml(page({ route: "/gallery", schema, words: 200 }), "/gallery"), { inboundCount: 5 });
    expect(r.issues.map((i) => i.id)).not.toContain("faq-structured");
  });

  it("reports invalid JSON-LD", () => {
    const html = page().replace("</head>", '<script type="application/ld+json">{bad json</script></head>');
    const r = scorePage(measureHtml(html, "/courses/piano-course"), { inboundCount: 5 });
    expect(r.issues.map((i) => i.id)).toContain("jsonld-valid");
  });

  it("penalizes a page with zero inbound links", () => {
    const r = scorePage(measureHtml(page(), "/courses/piano-course"), { inboundCount: 0 });
    expect(r.issues.find((i) => i.id === "inbound-links")?.lost).toBe(8);
  });
});

describe("scoreSite", () => {
  const mk = (route: string, links: string[], extra: PageOpts = {}) => page({ route, links, ...extra });

  it("computes inbound links from the link graph and finds orphans", () => {
    const pages = new Map([
      ["/", mk("/", ["/courses/a", "/courses/b", "/courses"], { words: 400, schema: [{ "@type": "EducationalOrganization" }, { "@type": "WebSite" }, { "@type": "WebPage" }] })],
      ["/courses/a", mk("/courses/a", ["/", "/courses/b", "/courses"])],
      ["/courses/b", mk("/courses/b", ["/", "/courses/a", "/courses"])],
      ["/courses/lonely", mk("/courses/lonely", ["/", "/courses/a", "/courses"])]
    ]);
    const report = scoreSite(pages);
    expect(report.orphans).toEqual(["/courses/lonely"]);
    expect(report.penalties.some((p) => p.id === "orphans")).toBe(true);
    expect(report.overall).toBeLessThan(report.averagePageScore);
  });

  it("detects duplicate titles and descriptions across pages", () => {
    const pages = new Map([
      ["/courses/a", mk("/courses/a", ["/courses/b"])],
      ["/courses/b", mk("/courses/b", ["/courses/a"])]
    ]);
    const report = scoreSite(pages);
    expect(report.duplicateTitles).toHaveLength(1);
    expect(report.duplicateDescriptions).toHaveLength(1);
  });

  it("reports rendered pages missing from the sitemap, and treats extra sitemap URLs as informational", () => {
    const pages = new Map([["/courses/a", mk("/courses/a", ["/courses/b"])], ["/courses/b", mk("/courses/b", ["/courses/a"], { title: "عنوان دیگر برای آزمون یکتا بودن عنوان صفحه دوم" , description: "توضیحات متفاوت و کافی برای صفحه دوم که باید یکتا باشد و طول مناسبی داشته باشد."})]]);
    const report = scoreSite(pages, { sitemapRoutes: ["/courses/a", "/blog"] });
    expect(report.penalties.some((p) => p.id === "sitemap-missing-pages")).toBe(true);
    expect(report.unverifiedSitemapRoutes).toEqual(["/blog"]);
    expect(report.penalties.some((p) => p.id === "sitemap-stale")).toBe(false);
  });

  it("penalizes a missing llms.txt", () => {
    const pages = new Map([["/courses/a", mk("/courses/a", ["/courses/a2"])]]);
    expect(scoreSite(pages, { llmsTxt: null }).penalties.some((p) => p.id === "llms-missing")).toBe(true);
  });
});
