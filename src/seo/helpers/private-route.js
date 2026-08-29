/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Private Route Guard
 * Description: Central classification for routes that must never
 * be indexed as public content.
 * --------------------------------------------------------
 */

const PRIVATE_ROUTE_PREFIXES = Object.freeze([
    "/admin",
    "/student"
]);

/**
 * Return true when a pathname belongs to a private application area.
 * Matching is segment-safe: /student is private, while /students is not.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPrivateRoute(pathname = "") {
    const normalized = String(pathname || "").split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";

    return PRIVATE_ROUTE_PREFIXES.some(
        (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    );
}

export { PRIVATE_ROUTE_PREFIXES };
