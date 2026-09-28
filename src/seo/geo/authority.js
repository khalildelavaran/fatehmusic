/**
 * Fateh Music Academy
 * GEO Authority Entity Layer
 *
 * Purpose:
 * Strengthen entity understanding for
 * search engines and AI answer engines.
 */

export function buildGeoAuthorityEntity(site = {}) {
    return {
        "@type": "EducationalOrganization",
        "@id": `${site.url}#authority`,

        "name": site.name,
        "alternateName": site.alternateName,

        "description":
            "آموزشگاه موسیقی فاتح در شوشتر، ارائه‌دهنده دوره‌های آموزش گیتار، پیانو، ویولن، آواز و موسیقی کودک.",

        "areaServed": site.areaServed || [
            "شوشتر",
            "خوزستان",
            "ایران"
        ],

        "knowsAbout": [
            "آموزش موسیقی",
            "آموزش گیتار",
            "آموزش پیانو",
            "آموزش ویولن",
            "آموزش آواز",
            "آموزش موسیقی کودک",
            "سلفژ"
        ],

        "sameAs": Object.values(site.socials || {})
            .filter((item) => typeof item === "string" && item.length > 0)
    };
}
