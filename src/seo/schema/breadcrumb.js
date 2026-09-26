/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Breadcrumb Schema
 * --------------------------------------------------------
 */

/**
 * Build a Google-compatible BreadcrumbList only from validated
 * visible navigation items.
 *
 * @param {{name: string, path: string}[]} items
 * @param {import("../resolvers/site.js").ResolvedSite} site
 * @returns {Object|null}
 */
export function buildBreadcrumbSchema(items, site) {
    const validated = validateBreadcrumbItems(items);

    if (!site?.url || validated.length < 2) {
        return null;
    }

    const finalUrl = absoluteUrl(validated[validated.length - 1].path, site.url);

    return {
        "@type": "BreadcrumbList",
        "@id": `${finalUrl}#breadcrumb`,
        itemListElement: validated.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path, site.url)
        }))
    };
}

function validateBreadcrumbItems(items) {
    if (!Array.isArray(items)) return [];

    const seen = new Set();
    const result = [];

    for (const item of items) {
        if (!item || typeof item.name !== "string" || !item.name.trim()) continue;
        if (typeof item.path !== "string" || !item.path.trim()) continue;

        const path = normalizePath(item.path);
        const key = path || "/";
        if (seen.has(key)) continue;

        seen.add(key);
        result.push({ name: item.name.trim(), path: key });
    }

    return result;
}

function normalizePath(path) {
    try {
        const parsed = new URL(path, "https://fatehmusic.ir");
        if (parsed.origin !== "https://fatehmusic.ir") return "";
        if (parsed.search || parsed.hash) return "";
        return parsed.pathname.replace(/\/$/, "") || "/";
    } catch {
        return "";
    }
}

function absoluteUrl(path, siteUrl) {
    return new URL(path, siteUrl).toString().replace(/\/$/, path === "/" ? "/" : "");
}
