/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: URL Helper
 * Description: The single place that turns a relative path
 * into an absolute URL. Everything else calls this instead
 * of concatenating strings on its own.
 * --------------------------------------------------------
 */

/**
 * Builds an absolute URL from a path (or passes an already
 * absolute URL through unchanged).
 *
 * @param {string} path
 * @param {string} baseUrl
 * @returns {string}
 */
export function absoluteUrl(path, baseUrl) {
    if (!path) {
        return baseUrl;
    }

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const normalizedBase = baseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return `${normalizedBase}${normalizedPath}`;
}

/**
 * Normalizes a public absolute HTTP(S) URL, returning undefined for
 * malformed URLs, other schemes, or URLs containing credentials.
 * This is used for external identity links such as Schema.org sameAs.
 *
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function normalizeHttpUrl(value) {
    if (typeof value !== "string") return undefined;
    const raw = value.trim();
    if (!raw) return undefined;

    try {
        const parsed = new URL(raw);
        if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
        if (!parsed.hostname || parsed.username || parsed.password) return undefined;
        return parsed.href;
    } catch {
        return undefined;
    }
}

/**
 * Strips query strings, fragments, and trailing slashes so the
 * same page never produces two different canonical URLs.
 *
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
    const withoutFragment = (path || "/").split("#")[0];
    const withoutQuery = withoutFragment.split("?")[0];

    return withoutQuery.length > 1
        ? withoutQuery.replace(/\/+$/, "")
        : withoutQuery;
}



/**
 * Canonical URL identity used by SEO/GSC/link-graph matching.
 * Query strings and fragments are removed; the root keeps "/".
 * Relative paths are supported as well.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    try {
        const url = new URL(raw);
        url.protocol = url.protocol.toLowerCase();
        url.hostname = url.hostname.toLowerCase();
        url.search = "";
        url.hash = "";
        url.pathname = url.pathname.replace(/\/+$/, "") || "/";
        return url.toString();
    } catch {
        const withoutFragment = raw.split("#")[0];
        const withoutQuery = withoutFragment.split("?")[0];
        const normalized = withoutQuery.length > 1
            ? withoutQuery.replace(/\/+$/, "")
            : (withoutQuery || "/");
        return normalized.toLowerCase();
    }
}


/**
 * Builds the canonical identity URL for a WebPage node.
 * The root keeps its conventional slash; non-root paths do not.
 *
 * @param {string} url
 * @returns {string}
 */
export function webPageEntityId(url) {
    const raw = String(url || "").trim();
    if (!raw) return "#webpage";

    try {
        const parsed = new URL(raw);
        parsed.search = "";
        parsed.hash = "";
        parsed.pathname = normalizePath(parsed.pathname || "/");
        return parsed.toString() + "#webpage";
    } catch {
        const normalized = normalizePath(raw);
        return normalized === "/"
            ? "/#webpage"
            : normalized + "#webpage";
    }
}
