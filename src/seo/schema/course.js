/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO/GEO Engine v2
 * Course Schema
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";
import {
    buildCourseInstructorRefs,
    buildCourseRef
} from "../geo/graph.js";

/**
 * @param {Object} course - a resolved course (from resolveCourse)
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {Object}
 */
export function buildCourseSchema(course, { site }) {
    const instructorRefs = buildCourseInstructorRefs(course);
    const courseInstance = buildCourseInstance(course, instructorRefs);
    const courseTopics = [
        course.instrument,
        course.title,
        course.category,
        ...(course.seo?.keywords || [])
    ].filter(Boolean);

    return pruneEmpty({
        "@type": SCHEMA_TYPES.COURSE,
        "@id": buildCourseRef(course)["@id"],
        url: course.url,
        name: course.title,
        description: course.description,
        image: course.image,
        keywords: [...new Set(courseTopics)],
        provider: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@id": `${course.url}/#webpage` },
        educationalLevel: course.level.join("، "),
        audience: course.ageGroup.length
            ? {
                  "@type": SCHEMA_TYPES.AUDIENCE,
                  audienceType: course.ageGroup.join("، ")
              }
            : undefined,
        coursePrerequisites: course.seoContent?.prerequisites,
        subjectOf: course.seoContent?.localContext?.length
            ? course.seoContent.localContext.map((text) => ({
                  "@type": "CreativeWork",
                  text
              }))
            : undefined,
        hasCourseInstance: courseInstance,
        offers: buildOffers(course.plan, site)
    });
}

function buildCourseInstance(course, instructorRefs) {
    const instance = {
        "@type": SCHEMA_TYPES.COURSE_INSTANCE,
        "@id": `${course.url}/#course-instance`,
        courseMode: course.classType,
        about: buildCourseRef(course),
        instructor: instructorRefs.length ? instructorRefs : undefined
    };

    return pruneEmpty(instance);
}

function buildOffers(plan, site) {
    if (!plan) {
        return undefined;
    }

    return Object.values(plan.paymentOptions).map((option) => ({
        "@type": SCHEMA_TYPES.OFFER,
        name: option.title,
        // pricing.js stores Toman; Schema.org priceCurrency requires ISO 4217,
        // so convert to Rial for structured data only.
        price: option.amount * 10,
        priceCurrency: "IRR",
        availability: "https://schema.org/InStock",
        url: `${site.url}/register`
    }));
}

function pruneEmpty(node) {
    return Object.fromEntries(
        Object.entries(node).filter(([, value]) => {
            if (value === undefined || value === null) return false;
            if (Array.isArray(value) && value.length === 0) return false;
            return true;
        })
    );
}
