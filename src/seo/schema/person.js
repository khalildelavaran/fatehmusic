/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Person Schema
 * --------------------------------------------------------
 */

import { SCHEMA_TYPES } from "../config/constants.js";
import { courseEntityId, instructorEntityId } from "../geo/entity.js";

/**
 * @param {Object} instructor - a resolved instructor (from resolveInstructor)
 * @param {Object} params
 * @param {import("../resolvers/site.js").ResolvedSite} params.site
 * @returns {Object}
 */
export function buildPersonSchema(instructor, { site }) {
    const taughtCourses = (instructor.courses || []).filter((course) => course?.slug);
    const taughtCourseRefs = taughtCourses.map((course) => ({
        "@id": courseEntityId(`${site.url}/courses/${course.slug}`)
    }));

    const knowsAbout = [
        ...(instructor.roles || []),
        ...taughtCourses.map((course) => course.title).filter(Boolean)
    ];

    return pruneEmpty({
        "@type": SCHEMA_TYPES.PERSON,
        "@id": instructorEntityId(instructor.url),
        name: instructor.name,
        jobTitle: instructor.position,
        description: instructor.bio,
        image: instructor.image,
        disambiguatingDescription: buildDisambiguatingDescription(instructor),
        worksFor: { "@id": `${site.url}/#organization` },
        mainEntityOfPage: { "@id": `${String(instructor.url).replace(/\/$/, "")}/#webpage` },
        teaches: taughtCourseRefs.length ? taughtCourseRefs : undefined,
        knowsAbout: [...new Set(knowsAbout)].filter(Boolean),
        sameAs: instructor.sameAs && instructor.sameAs.length ? instructor.sameAs : undefined
    });
}

function buildDisambiguatingDescription(instructor) {
    const role = instructor.position || "مدرس موسیقی";
    const experience = instructor.experienceYears ? ` با ${instructor.experienceYears} سال سابقه` : "";
    return `${instructor.name}؛ ${role}${experience} در آموزشگاه موسیقی فاتح شوشتر.`;
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
