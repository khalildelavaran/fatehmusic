/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Site Resolver
 * Description:
 * The only place that reads data/site.js and
 * data/contact.js directly.
 * Everything downstream receives this normalized object.
 * --------------------------------------------------------
 */

import { site } from "../../data/site.js";
import { contact } from "../../data/contact.js";
import { absoluteUrl } from "../helpers/url.js";

import {
    toLatinDigits,
    expandWeekdayRange
} from "../helpers/text.js";

import { SCHEMA_TYPES } from "../config/constants.js";


/**
 * @typedef {Object} ResolvedSite
 * @property {string[]} schemaType
 * @property {string} name
 * @property {string} alternateName
 * @property {string} shortName
 * @property {string} legalName
 * @property {string} url
 * @property {string} logo
 * @property {string} image
 * @property {string} favicon
 * @property {string} description
 * @property {string[]} keywords
 * @property {string} telephone
 * @property {string} mobile
 * @property {string} email
 * @property {Object} address
 * @property {Object} geo
 * @property {Object[]} openingHoursSpecification
 * @property {string} priceRange
 * @property {string[]} sameAs
 * @property {string} mapUrl
 * @property {Object[]} areaServed
 * @property {string} facebookId
 */


/**
 * Builds normalized Site contract.
 *
 * @returns {ResolvedSite}
 */
export function resolveSite() {

    return Object.freeze({

        schemaType:
            site.schemaType || [
                SCHEMA_TYPES.LOCAL_EDUCATION_BUSINESS,
                SCHEMA_TYPES.EDUCATIONAL_ORGANIZATION
            ],


        name:
            site.name,


        alternateName:
            site.alternateName ||
            site.shortName,


        shortName:
            site.shortName,


        legalName:
            site.legalName,


        url:
            site.url,


        logo:
            absoluteUrl(
                site.logo,
                site.url
            ),


        image:
            absoluteUrl(
                site.image,
                site.url
            ),


        favicon:
            site.favicon,


        description:
            site.description,


        keywords:
            site.keywords || [],


        telephone:
            normalizePhone(
                contact.phones.landline.raw
            ),


        mobile:
            normalizePhone(
                contact.phones.mobile.raw
            ),


        email:
            site.email,


        address: {
            ...site.address,
            addressCountry:
                "IR"
        },


        geo: {
            ...site.geo
        },


        areaServed:
            buildAreaServed(
                site.areaServed
            ),


        priceRange:
            site.priceRange ||
            "1,000,000 - 1,600,000 تومان",


        openingHoursSpecification:
            buildOpeningHoursSpecification(
                contact.workingHours
            ),


   mapUrl:
       site.mapUrl ||
       contact.map?.google ||
       undefined,


   sameAs:
       dedupeSameAs(
           site.socials
       ),


   facebookId:
       site.socials?.facebookId || undefined

    });

}



/**
 * Normalize Iranian phone numbers
 */
function normalizePhone(rawPhone) {

    const digitsOnly =
        toLatinDigits(rawPhone)
        .replace(/\D/g, "");


    return digitsOnly.startsWith("0")
        ? `+98${digitsOnly.slice(1)}`
        : `+${digitsOnly}`;

}



/**
 * Convert working hours to Schema.org format
 */
function buildOpeningHoursSpecification(
    workingHours
) {

    return (workingHours || []).map((entry) => {

        const [
            opensRaw,
            closesRaw
        ] = entry.value
            .split("تا")
            .map(
                (part) =>
                    part.trim()
            );


        return {

            "@type":
                SCHEMA_TYPES.OPENING_HOURS_SPEC,


            dayOfWeek:
                expandWeekdayRange(
                    entry.title
                ),


            opens:
                toLatinDigits(
                    opensRaw
                ),


            closes:
                toLatinDigits(
                    closesRaw
                )

        };

    });

}



/**
 * Normalize service areas into Schema.org Place objects.
 */
function buildAreaServed(areas) {
  if (!Array.isArray(areas)) {
    return [];
  }

  return areas
    .filter(Boolean)
    .map((area) => ({
      "@type": SCHEMA_TYPES.ADMINISTRATIVE_AREA,
      name: area
    }));
}

/**
 * Remove duplicate social links.
 *
 * Only social profile URLs belong in sameAs.
 * Facebook Page ID must never be included.
 */
function dedupeSameAs(socials) {

    if (!socials) {
        return [];
    }


    return [

        socials.facebook,
        socials.instagram,
        socials.youtube,
        socials.telegram,
        socials.x,
        socials.aparat

    ]
    .filter(
        (value) =>
            typeof value === "string" &&
            value.trim().length > 0
    )
    .filter(
        (value, index, array) =>
            array.indexOf(value) === index
    );

}
