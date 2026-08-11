/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Site Resolver
 * Description: The only place that reads data/site.js and
 * data/contact.js directly. Everything downstream (builders,
 * schema modules) only ever sees the normalized object this
 * function returns.
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
 * @property {string} name
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
 */

/**
 * Builds the normalized Site contract.
 *
 * @returns {ResolvedSite}
 */
export function resolveSite() {
  return Object.freeze({
    name: site.name,
    shortName: site.shortName,
    legalName: site.legalName,

    url: site.url,

    logo: absoluteUrl(site.logo, site.url),
    image: absoluteUrl(site.image, site.url),
    favicon: site.favicon,

    description: site.description,
    keywords: site.keywords || [],

    telephone: normalizePhone(
      contact.phones.landline.raw
    ),

    mobile: normalizePhone(
      contact.phones.mobile.raw
    ),

    email: site.email,

    address: {
      ...site.address,
      addressCountry: "IR"
    },

    geo: {
      ...site.geo
    },

    areaServed: buildAreaServed(
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
      dedupeSameAs(site.socials)
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
      .map((part) => part.trim());

    return {
      "@type":
        SCHEMA_TYPES.OPENING_HOURS_SPEC,

      dayOfWeek:
        expandWeekdayRange(
          entry.title
        ),

      opens:
        toLatinDigits(opensRaw),

      closes:
        toLatinDigits(closesRaw)
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
      "@type": "Place",
      name: area
    }));
}

/**
 * Remove duplicate social links.
 *
 * Only valid social profile URLs are allowed in sameAs.
 * Internal IDs such as Facebook Page ID must never be
 * included in sameAs.
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
