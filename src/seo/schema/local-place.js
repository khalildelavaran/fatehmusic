/** Fateh Music Academy — canonical local business entity schema. */
import { absoluteUrl } from "../helpers/url.js";

/**
 * The Shushtar location is modeled as the concrete local business entity.
 * Keep this node synchronized with the visible location/contact details.
 */
export function buildLocalPlaceSchema(site) {
  const url = absoluteUrl("/locations/shushtar", site.url).replace(/\/$/, "");

  return {
    "@type": "LocalBusiness",
    "@id": url + "#localbusiness",
    name: "آموزشگاه موسیقی فاتح شوشتر",
    url,
    description: "آموزشگاه موسیقی فاتح در شوشتر؛ ارائه دوره‌های آموزش ساز، آواز و دروس پایه موسیقی.",
    image: site.image,
    logo: { "@type": "ImageObject", url: site.logo },
    telephone: site.telephone,
    email: site.email,
    priceRange: site.priceRange,
    address: {
      "@type": "PostalAddress",
      ...site.address,
      addressCountry: site.address?.addressCountry || "IR"
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.geo.latitude,
      longitude: site.geo.longitude
    },
    hasMap: site.mapUrl,
    openingHoursSpecification: site.openingHoursSpecification,
    sameAs: site.sameAs,
    areaServed: site.areaServed,
    parentOrganization: { "@id": site.url + "/#organization" },
    containedInPlace: { "@type": "City", name: "شوشتر", containedInPlace: { "@type": "AdministrativeArea", name: "خوزستان" } },
    mainEntityOfPage: { "@id": url + "#webpage" }
  };
}
