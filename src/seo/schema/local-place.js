/** Fateh Music Academy — local entity schema. */
import { SCHEMA_TYPES } from "../config/constants.js";
import { absoluteUrl } from "../helpers/url.js";

export function buildLocalPlaceSchema(site) {
  const url = absoluteUrl("/locations/shushtar", site.url);
  return {
    "@type": SCHEMA_TYPES.PLACE,
    "@id": `${url}#place`,
    name: "آموزش موسیقی در شوشتر",
    url,
    description: "اطلاعات محلی درباره آموزش موسیقی و آموزشگاه موسیقی فاتح در شوشتر، خوزستان.",
    address: {
      "@type": SCHEMA_TYPES.POSTAL_ADDRESS,
      ...site.address,
      addressCountry: site.address.addressCountry || "IR"
    },
    geo: {
      "@type": SCHEMA_TYPES.GEO_COORDINATES,
      latitude: site.geo.latitude,
      longitude: site.geo.longitude
    },
    hasMap: site.mapUrl,
    isPartOf: { "@id": `${site.url}/#organization` },
    mainEntityOfPage: { "@id": `${url}#webpage` },
    containedInPlace: { "@id": `${site.url}/#organization` }
  };
}
