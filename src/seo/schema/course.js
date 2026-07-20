/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Course Schema
 * Description: Takes an already-resolved course (see
 * resolvers/course.js) and produces its Course JSON-LD node.
 * Instructors and the provider are referenced by "@id" rather
 * than repeated in full, per schema.org best practice.
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";

/**
 * @param {Object} course - a resolved course (from resolveCourse)
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {Object}
 */
export function buildCourseSchema(course, { site }) {
    const instructorRefs = (course.instructors || []).map((instructor) => ({
        "@id": `${site.url}/instructors/${instructor.slug}/#person`
    }));

    return pruneEmpty({
        "@type": SCHEMA_TYPES.COURSE,
        "@id": `${course.url}/#course`,
        name: course.title,
        description: course.description,
        image: course.image,
        provider: { "@id": `${site.url}/#organization` },
        courseMode: course.classType,
        educationalLevel: course.level.join("، "),
        audience: course.ageGroup.length
            ? {
                  "@type": SCHEMA_TYPES.AUDIENCE,
                  audienceType: course.ageGroup.join("، ")
              }
            : undefined,
        instructor: instructorRefs.length ? instructorRefs : undefined,
        offers: buildOffers(course.plan, site)
    });
}

function buildOffers(plan, site) {
    if (!plan) {
        return undefined;
    }

    return Object.values(plan.paymentOptions).map((option) => ({
        "@type": SCHEMA_TYPES.OFFER,
        name: option.title,
        // pricing.js stores Toman (the currency shown to visitors
        // everywhere else on the site); schema.org's priceCurrency is
        // ISO 4217 only, so this is the one place that converts to Rial.
        price: option.amount * 10,
        priceCurrency: "IRR",
        availability: "https://schema.org/InStock",
        url: `${site.url}/register`
    }));
}

function pruneEmpty(node) {
    return Object.fromEntries(
        Object.entries(node).filter(([, value]) => value !== undefined)
    );
}
