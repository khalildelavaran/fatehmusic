/**
 * Local Place schema for public location/entity pages.
 */
import { SCHEMA_TYPES } from "../config/constants.js";

export function buildLocalPlaceSchema({ site, title, description, url }) {
    return {
        "@type": SCHEMA_TYPES.PLACE,
        "@id": `${url}#place`,
        name: title,
        description,
        url,
        image: site.image,
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
        containedInPlace: {
            "@type": SCHEMA_TYPES.CITY,
            name: site.address.addressLocality
        },
        isPartOf: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@id": `${url}#webpage` }
    };
}
