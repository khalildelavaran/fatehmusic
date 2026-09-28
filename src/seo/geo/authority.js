/**
 * Fateh Music Academy — GEO authority entity.
 * This node is supplemental to the canonical Organization node and uses
 * the normalized ResolvedSite contract, so social/entity data stays consistent.
 */

/** @param {any} site */
export function buildGeoAuthorityEntity(site = {}) {
    const url = String(site.url || "").replace(/\/$/, "");
    return {
        "@type": "EducationalOrganization",
        "@id": `${url}#authority`,
        "name": site.name,
        "alternateName": site.alternateName,
        "description": "آموزشگاه موسیقی فاتح در شوشتر، ارائه‌دهنده دوره‌های آموزش موسیقی و آموزش ساز و آواز.",
        "url": url,
        "logo": site.logo ? { "@type": "ImageObject", url: site.logo } : undefined,
        "image": site.image,
        "telephone": site.telephone,
        "email": site.email,
        "areaServed": site.areaServed || [],
        "knowsAbout": [
            "آموزش موسیقی",
            "آموزش گیتار",
            "آموزش پیانو",
            "آموزش ویولن",
            "آموزش کمانچه",
            "آموزش تار و سه‌تار",
            "آموزش سنتور",
            "آموزش آواز",
            "آموزش موسیقی کودک",
            "سلفژ",
            "تئوری موسیقی",
            "ریتم و وزن‌خوانی"
        ],
        "sameAs": Array.isArray(site.sameAs) ? site.sameAs : []
    };
}
