/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Measured score engine.
 *
 * Unlike auditPage() (which scores a context object that the calling page
 * supplies about itself), this module scores what is actually present in
 * rendered HTML. Every number is deterministic and every point lost carries
 * a human-readable reason. It is a quality gate, not a ranking predictor.
 * --------------------------------------------------------
 */

export const SITE_ORIGIN = "https://fatehmusic.ir";

/** Weights sum to 100. Changing them is a deliberate, reviewable act. */
export const DIMENSION_WEIGHTS = Object.freeze({
    technical: 15,
    metadata: 15,
    structure: 10,
    schema: 20,
    linking: 15,
    content: 10,
    images: 10,
    geo: 5
});

const TITLE_RANGE = [20, 70];
const DESCRIPTION_RANGE = [80, 170];

/** Minimum visible words for a page type to count as non-thin. */
const MIN_WORDS = Object.freeze({
    home: 300,
    listing: 250,
    course: 500,
    instructor: 400,
    location: 300,
    about: 500,
    contact: 200,
    gallery: 100,
    blog: 500,
    other: 100
});

/** Schema types a page of this type is expected to carry (all verified against real content). */
const EXPECTED_SCHEMA = Object.freeze({
    home: ["WebSite", "WebPage"],
    listing: ["WebPage", "ItemList", "BreadcrumbList"],
    course: ["WebPage", "Course", "BreadcrumbList"],
    instructor: ["WebPage", "Person", "BreadcrumbList"],
    location: ["WebPage", "LocalBusiness", "BreadcrumbList"],
    about: ["WebPage", "BreadcrumbList"],
    contact: ["WebPage", "BreadcrumbList"],
    gallery: ["WebPage", "BreadcrumbList"],
    blog: ["WebPage", "Article", "BreadcrumbList"],
    other: ["WebPage"]
});

/** Minimum internal inbound links a page of this type should have from other pages. */
const MIN_INBOUND = Object.freeze({
    home: 0,
    listing: 3,
    course: 3,
    instructor: 3,
    location: 10,
    about: 3,
    contact: 3,
    gallery: 1,
    blog: 1,
    other: 1
});

const BREADCRUMB_EXEMPT = new Set(["home", "other"]);

export function detectPageType(route) {
    if (route === "/") return "home";
    if (route === "/courses" || route === "/instructors") return "listing";
    if (/^\/courses\/[^/]+$/.test(route)) return "course";
    if (/^\/instructors\/[^/]+$/.test(route)) return "instructor";
    if (route === "/blog") return "listing";
    if (/^\/blog\/[^/]+$/.test(route)) return "blog";
    if (/^\/locations\/[^/]+$/.test(route)) return "location";
    if (route === "/about") return "about";
    if (route === "/contact") return "contact";
    if (route === "/gallery") return "gallery";
    return "other";
}

function firstMatch(re, html) {
    const match = html.match(re);
    return match ? match[1].trim() : "";
}

function parseAttrs(tag) {
    const attrs = {};
    for (const m of tag.matchAll(/([a-zA-Z_:][\w:.-]*)(?:="([^"]*)")?/g)) {
        if (m[1] && !(m[1] in attrs)) attrs[m[1].toLowerCase()] = m[2] ?? "";
    }
    return attrs;
}

export function normalizeInternalHref(href) {
    if (!href) return null;
    let value = href.trim();
    if (value.startsWith(SITE_ORIGIN)) value = value.slice(SITE_ORIGIN.length) || "/";
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    value = value.split("#")[0].split("?")[0];
    if (value.length > 1) value = value.replace(/\/+$/, "");
    return value || "/";
}

export function extractJsonLdNodes(html) {
    const nodes = [];
    let invalid = 0;
    for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
        try {
            const parsed = JSON.parse(m[1]);
            for (const node of Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [parsed]) {
                if (node && typeof node === "object") nodes.push(node);
            }
        } catch {
            invalid += 1;
        }
    }
    return { nodes, invalid };
}

function schemaTypes(node) {
    return [].concat(node?.["@type"] ?? []).filter(Boolean);
}

/**
 * Measure a rendered HTML document. Pure: no filesystem, no network.
 * @param {string} html
 * @param {string} route normalized route ("/", "/courses/x")
 */
export function measureHtml(html, route) {
    const body = html
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<style[\s\S]*?<\/style>/g, " ");
    const text = body.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

    const headings = [...body.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    const images = [...body.matchAll(/<img\b[^>]*>/g)].map((m) => parseAttrs(m[0]));
    const { nodes, invalid } = extractJsonLdNodes(html);
    const types = new Set(nodes.flatMap(schemaTypes));

    const outbound = new Set();
    for (const m of body.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        const target = normalizeInternalHref(m[1]);
        if (target && target !== route) outbound.add(target);
    }

    const canonicalHref = firstMatch(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/, html);
    const expectedCanonical = SITE_ORIGIN + (route === "/" ? "" : route);

    return {
        route,
        pageType: detectPageType(route),
        lang: firstMatch(/<html[^>]*\blang="([^"]*)"/, html),
        title: firstMatch(/<title>([\s\S]*?)<\/title>/, html),
        description: firstMatch(/<meta name="description" content="([^"]*)"/, html),
        robots: firstMatch(/<meta name="robots" content="([^"]*)"/, html),
        canonical: canonicalHref,
        canonicalMatchesRoute: canonicalHref.replace(/\/$/, "") === expectedCanonical,
        canonicalCount: (html.match(/<link[^>]*rel="canonical"/g) || []).length,
        ogComplete: ["og:title", "og:description", "og:image", "og:url"].every((p) => html.includes(`property="${p}"`)),
        twitterCard: html.includes('name="twitter:card"'),
        h1Count: headings.filter((h) => h === 1).length,
        headingSkips: headings.reduce((n, h, i) => (i > 0 && h - headings[i - 1] > 1 ? n + 1 : n), 0),
        words: text ? text.split(" ").length : 0,
        imageCount: images.length,
        imagesMissingAlt: images.filter((a) => !("alt" in a)).length,
        imagesMissingDimensions: images.filter((a) => !a.width || !a.height).length,
        firstImageLazy: images.length > 0 && images[0].loading === "lazy",
        jsonLdInvalid: invalid,
        schemaTypes: [...types].sort(),
        hasFaq: types.has("FAQPage"),
        hasBreadcrumb: types.has("BreadcrumbList"),
        hasOrganization: ["Organization", "LocalBusiness", "EducationalOrganization"].some((t) => types.has(t)),
        outbound: [...outbound].sort()
    };
}

const inRange = (n, [min, max]) => n >= min && n <= max;

function check(list, id, max, earned, reason) {
    list.push({ id, max, points: Math.max(0, Math.min(max, earned)), reason: earned >= max ? "ok" : reason });
}

function dimension(name, checks) {
    const max = checks.reduce((s, c) => s + c.max, 0);
    const points = checks.reduce((s, c) => s + c.points, 0);
    return { name, weight: DIMENSION_WEIGHTS[name], score: max ? points / max : 1, checks };
}

/**
 * Score one measured page. `inboundCount` comes from the site link graph.
 * @param {ReturnType<typeof measureHtml>} m
 * @param {{ inboundCount?: number }} [ctx]
 */
export function scorePage(m, ctx = {}) {
    const inbound = ctx.inboundCount ?? 0;

    const technical = [];
    check(technical, "canonical-single", 4, m.canonicalCount === 1 ? 4 : 0, `expected exactly 1 canonical, found ${m.canonicalCount}`);
    check(technical, "canonical-matches-route", 4, m.canonicalMatchesRoute ? 4 : 0, "canonical does not equal the rendered route");
    check(technical, "indexable", 4, !/\bnoindex\b/i.test(m.robots) ? 4 : 0, `robots meta is "${m.robots}"`);
    check(technical, "lang", 3, m.lang.startsWith("fa") ? 3 : 0, `html lang is "${m.lang}", expected fa`);

    const metadata = [];
    check(metadata, "title-length", 5, inRange(m.title.length, TITLE_RANGE) ? 5 : 0, `title length ${m.title.length} outside ${TITLE_RANGE.join("-")}`);
    check(metadata, "description-length", 5, inRange(m.description.length, DESCRIPTION_RANGE) ? 5 : 0, `description length ${m.description.length} outside ${DESCRIPTION_RANGE.join("-")}`);
    check(metadata, "open-graph", 3, m.ogComplete ? 3 : 0, "og:title/description/image/url incomplete");
    check(metadata, "twitter-card", 2, m.twitterCard ? 2 : 0, "twitter:card missing");

    const structure = [];
    check(structure, "single-h1", 6, m.h1Count === 1 ? 6 : 0, `found ${m.h1Count} H1 elements`);
    check(structure, "heading-order", 4, m.headingSkips === 0 ? 4 : 0, `${m.headingSkips} heading level skips`);

    const expected = EXPECTED_SCHEMA[m.pageType] ?? EXPECTED_SCHEMA.other;
    const present = new Set(m.schemaTypes);
    const missing = expected.filter((t) => !present.has(t));
    const schema = [];
    check(schema, "jsonld-valid", 6, m.jsonLdInvalid === 0 && m.schemaTypes.length > 0 ? 6 : 0, m.schemaTypes.length ? `${m.jsonLdInvalid} invalid JSON-LD blocks` : "no JSON-LD present");
    check(schema, "publisher-entity", 4, m.hasOrganization ? 4 : 0, "Organization/LocalBusiness entity missing");
    check(
        schema,
        "expected-types",
        10,
        Math.round(10 * (expected.length - missing.length) / expected.length),
        `missing expected types for ${m.pageType}: ${missing.join(", ")}`
    );

    const linking = [];
    const minInbound = MIN_INBOUND[m.pageType] ?? 1;
    check(linking, "inbound-links", 8, inbound === 0 && m.route !== "/" ? 0 : inbound >= minInbound ? 8 : 4, `${inbound} inbound links, expected >= ${minInbound}`);
    check(linking, "outbound-links", 4, m.outbound.length >= 3 ? 4 : m.outbound.length >= 1 ? 2 : 0, `${m.outbound.length} distinct internal outbound links`);
    const needsBreadcrumb = !BREADCRUMB_EXEMPT.has(m.pageType);
    check(linking, "breadcrumb", 3, !needsBreadcrumb || m.hasBreadcrumb ? 3 : 0, "BreadcrumbList missing on inner page");

    const content = [];
    const minWords = MIN_WORDS[m.pageType] ?? MIN_WORDS.other;
    check(content, "not-thin", 10, m.words >= minWords ? 10 : Math.round(10 * m.words / minWords), `${m.words} visible words vs ${minWords} expected for ${m.pageType}`);

    const images = [];
    check(images, "alt-text", 5, m.imagesMissingAlt === 0 ? 5 : 0, `${m.imagesMissingAlt} images without alt`);
    check(images, "dimensions", 3, m.imagesMissingDimensions === 0 ? 3 : 0, `${m.imagesMissingDimensions} images without width/height`);
    check(images, "lcp-not-lazy", 2, m.firstImageLazy ? 0 : 2, "first image is lazy-loaded");

    const geo = [];
    const faqExpected = ["course", "instructor", "about", "contact"].includes(m.pageType);
    check(geo, "faq-structured", 3, !faqExpected || m.hasFaq ? 3 : 0, "page type normally carries a real FAQ but none is marked up");
    check(geo, "entity-attribution", 2, m.hasOrganization && m.canonicalMatchesRoute ? 2 : 0, "no attributable organization entity on this URL");

    const dimensions = [
        dimension("technical", technical),
        dimension("metadata", metadata),
        dimension("structure", structure),
        dimension("schema", schema),
        dimension("linking", linking),
        dimension("content", content),
        dimension("images", images),
        dimension("geo", geo)
    ];
    const total = dimensions.reduce((s, d) => s + d.weight * d.score, 0);
    const score = Math.round(total) / 10;

    return {
        route: m.route,
        pageType: m.pageType,
        score,
        dimensions: Object.fromEntries(dimensions.map((d) => [d.name, Math.round(d.score * 1000) / 100])),
        issues: dimensions.flatMap((d) => d.checks.filter((c) => c.points < c.max).map((c) => ({ dimension: d.name, id: c.id, lost: c.max - c.points, reason: c.reason })))
    };
}

/**
 * Score a whole site. `pages` maps route -> HTML string.
 * @param {Map<string,string>|Record<string,string>} pages
 * @param {{ sitemapRoutes?: Iterable<string>, llmsTxt?: string|null }} [ctx]
 */
export function scoreSite(pages, ctx = {}) {
    const entries = pages instanceof Map ? [...pages.entries()] : Object.entries(pages);
    const measured = entries.map(([route, html]) => measureHtml(html, route));

    const inbound = new Map(measured.map((m) => [m.route, new Set()]));
    for (const m of measured) {
        for (const target of m.outbound) inbound.get(target)?.add(m.route);
    }

    const pageScores = measured.map((m) => scorePage(m, { inboundCount: inbound.get(m.route)?.size ?? 0 }));

    const sitemap = ctx.sitemapRoutes ? new Set(ctx.sitemapRoutes) : null;
    const routes = measured.map((m) => m.route);
    const orphans = routes.filter((r) => r !== "/" && (inbound.get(r)?.size ?? 0) === 0);
    const notInSitemap = sitemap ? routes.filter((r) => !sitemap.has(r)) : [];
    const staleSitemap = sitemap ? [...sitemap].filter((r) => !routes.includes(r)) : [];

    const titleCounts = new Map();
    const descCounts = new Map();
    for (const m of measured) {
        titleCounts.set(m.title, (titleCounts.get(m.title) || 0) + 1);
        descCounts.set(m.description, (descCounts.get(m.description) || 0) + 1);
    }
    const duplicateTitles = [...titleCounts].filter(([t, n]) => t && n > 1).map(([t]) => t);
    const duplicateDescriptions = [...descCounts].filter(([d, n]) => d && n > 1).map(([d]) => d);

    const avg = pageScores.length ? pageScores.reduce((s, p) => s + p.score, 0) / pageScores.length : 0;
    const min = pageScores.length ? Math.min(...pageScores.map((p) => p.score)) : 0;

    // Site-level penalties are explicit and capped so the average cannot hide structural defects.
    const penalties = [];
    const penalize = (id, points, reason) => { if (points > 0) penalties.push({ id, points: Math.min(points, 1), reason }); };
    penalize("orphans", orphans.length * 0.25, `${orphans.length} orphan pages: ${orphans.join(", ")}`);
    penalize("duplicate-titles", duplicateTitles.length * 0.25, `${duplicateTitles.length} duplicated titles`);
    penalize("duplicate-descriptions", duplicateDescriptions.length * 0.25, `${duplicateDescriptions.length} duplicated descriptions`);
    penalize("sitemap-missing-pages", notInSitemap.length * 0.1, `${notInSitemap.length} rendered pages absent from sitemap: ${notInSitemap.join(", ")}`);
    if (ctx.llmsTxt === null) penalties.push({ id: "llms-missing", points: 0.3, reason: "llms.txt not present" });

    const penalty = penalties.reduce((s, p) => s + p.points, 0);
    const overall = Math.max(0, Math.round((avg - penalty) * 10) / 10);

    return {
        overall,
        averagePageScore: Math.round(avg * 10) / 10,
        minPageScore: min,
        pageCount: pageScores.length,
        penalties,
        orphans,
        // Informational only: SSR routes (blog, guitar styles) legitimately have no static HTML to verify.
        unverifiedSitemapRoutes: staleSitemap,
        duplicateTitles,
        duplicateDescriptions,
        pages: pageScores.sort((a, b) => a.score - b.score)
    };
}
