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
