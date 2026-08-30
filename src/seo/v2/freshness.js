/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Freshness helpers for published/modified content.
 * --------------------------------------------------------
 */

export function toIsoDate(value) {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function daysSince(value, now = new Date()) {
    const iso = toIsoDate(value);
    if (!iso) return undefined;
    const then = new Date(iso).getTime();
    return Math.max(0, Math.floor((now.getTime() - then) / 86400000));
}

/**
 * @param {string|Date|undefined} value
 * @param {number} [freshDays=180]
 */
export function getFreshness(value, freshDays = 180) {
    const ageDays = daysSince(value);
    if (ageDays === undefined) {
        return { status: "unknown", ageDays: undefined, lastModified: undefined };
    }

    let status = "fresh";
    if (ageDays > freshDays * 2) status = "stale";
    else if (ageDays > freshDays) status = "aging";

    return Object.freeze({
        status,
        ageDays,
        lastModified: toIsoDate(value)
    });
}
