/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Organization Schema
 * Description: The one node every other schema node on the
 * site refers back to via "@id": `${site.url}/#organization`.
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";

/**
 * @param {import("../resolvers/site.js").ResolvedSite} site
 * @returns {Object}
 */
export function buildOrganizationSchema(site) {
    return {
        "@type": SCHEMA_TYPES.LOCAL_EDUCATION_BUSINESS,
        "@id": `${site.url}/#organization`,

        name: site.name,
        alternateName: site.shortName,
        description: site.description,

        url: site.url,
        logo: site.logo,
        image: site.image,

        telephone: site.telephone,
        email: site.email,

        priceRange: site.priceRange,

        founder: {
            "@type": SCHEMA_TYPES.PERSON,
            name: "خلیل دلاوران"
        },

        areaServed: {
            "@type": "City",
            name: "شوشتر"
        },

        address: {
            "@type": SCHEMA_TYPES.POSTAL_ADDRESS,
            ...site.address,
            addressCountry: "IR"
        },

        geo: {
            "@type": SCHEMA_TYPES.GEO_COORDINATES,
            ...site.geo
        },

        hasMap: site.mapUrl,

        openingHoursSpecification:
            site.openingHoursSpecification,

        sameAs: site.sameAs
    };
}