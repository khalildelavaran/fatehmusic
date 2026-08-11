/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Organization Schema
 * Description:
 * Main organization entity referenced by all schema nodes
 * through "@id": `${site.url}/#organization`
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";

/**
 * @param {import("../resolvers/site.js").ResolvedSite} site
 * @returns {Object}
 */
export function buildOrganizationSchema(site) {

    return {
        "@type": site.schemaType || [
            SCHEMA_TYPES.LOCAL_EDUCATION_BUSINESS,
            SCHEMA_TYPES.EDUCATIONAL_ORGANIZATION
        ],

        "@id":
            `${site.url}/#organization`,

        name:
            site.name,

        alternateName:
            site.alternateName ||
            site.shortName,

        legalName:
            site.legalName,

        description:
            site.description,

        url:
            site.url,


        logo: {
            "@type": "ImageObject",
            url: site.logo
        },


        image:
            site.image,


        telephone:
            site.telephone,


        email:
            site.email,


        priceRange:
            site.priceRange,


        founder: {
            "@type": SCHEMA_TYPES.PERSON,
            name: "خلیل دلاوران"
        },


        address: {
            "@type": SCHEMA_TYPES.POSTAL_ADDRESS,
            ...site.address,
            addressCountry:
                site.address.addressCountry || "IR"
        },


        geo: {
            "@type": SCHEMA_TYPES.GEO_COORDINATES,
            latitude:
                site.geo.latitude,
            longitude:
                site.geo.longitude
        },


        hasMap:
            site.mapUrl,


        /**
         * Already normalized in resolveSite()
         * Do not convert again.
         */
        areaServed:
            site.areaServed,


        openingHoursSpecification:
            site.openingHoursSpecification,


        sameAs:
            site.sameAs
    };

}
