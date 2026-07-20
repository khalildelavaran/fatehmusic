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
import { toLatinDigits, expandWeekdayRange } from "../helpers/text.js";

/**
 * @typedef {Object} ResolvedSite
 * @property {string} name
 * @property {string} shortName
 * @property {string} url
 * @property {string} logo
 * @property {string} image
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
        telephone: normalizePhone(contact.phones.landline.raw),
        mobile: normalizePhone(contact.phones.mobile.raw),
        email: site.email,
        address: { ...site.address },
        geo: { ...site.geo },
        priceRange: site.priceRange,
        openingHoursSpecification: buildOpeningHoursSpecification(
            contact.workingHours
        ),
        mapUrl: contact.map ? contact.map.google : undefined,
        sameAs: dedupeSameAs(site.socials)
    });
}

function normalizePhone(rawPhone) {
    const digitsOnly = toLatinDigits(rawPhone).replace(/\D/g, "");

    return digitsOnly.startsWith("0")
        ? `+98${digitsOnly.slice(1)}`
        : `+${digitsOnly}`;
}

function buildOpeningHoursSpecification(workingHours) {
    return (workingHours || []).map((entry) => {
        const [opensRaw, closesRaw] = entry.value
            .split("تا")
            .map((part) => part.trim());

        return {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: expandWeekdayRange(entry.title),
            opens: toLatinDigits(opensRaw),
            closes: toLatinDigits(closesRaw)
        };
    });
}

function dedupeSameAs(socials) {
    return [...new Set(Object.values(socials || {}).filter(Boolean))];
}
