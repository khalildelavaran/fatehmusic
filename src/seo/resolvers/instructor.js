/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Instructor Resolver
 * --------------------------------------------------------
 */

import { instructors } from "../../data/instructors.js";
import { courses } from "../../data/courses.js";
import { instructorContent } from "../../data/instructor-content.js";
import { absoluteUrl } from "../helpers/url.js";

/**
 * @typedef {Object} ResolvedInstructor
 * @property {number} id
 * @property {string} slug
 * @property {string} name
 * @property {string} position
 * @property {string|undefined} bio
 * @property {string|undefined} image
 * @property {number|undefined} experienceYears
 * @property {string[]} roles
 * @property {string[]} sameAs
 * @property {Object[]} courses
 * @property {Object|null} seoContent
 * @property {{question:string,answer:string}[]} faqs
 * @property {string} url
 */

/**
 * Resolves an instructor (by slug or raw object) into the
 * Instructor contract.
 *
 * @param {string|Object} slugOrInstructor
 * @param {import("./site.js").ResolvedSite} site
 * @returns {ResolvedInstructor|null}
 */
export function resolveInstructor(slugOrInstructor, site) {
    const instructor =
        typeof slugOrInstructor === "string"
            ? instructors.find((item) => item.slug === slugOrInstructor)
            : slugOrInstructor;

    if (!instructor) {
        return null;
    }

    const taughtCourses = courses.filter((course) =>
        getInstructorIds(course).includes(instructor.id)
    );

    // Optional long-form SEO/GEO content (instructor-content.js). Most
    // instructors don't have an entry yet, so this is `null` for them —
    // page templates must render without the extended sections in that case.
    const extendedContent = instructorContent[instructor.slug] || null;

    return Object.freeze({
        id: instructor.id,
        slug: instructor.slug,
        name: instructor.name,
        position: instructor.position,
        bio: instructor.content ? instructor.content.biography : undefined,
        image: instructor.media
            ? absoluteUrl(instructor.media.images.profile, site.url)
            : undefined,
        experienceYears: instructor.professional
            ? instructor.professional.experienceYears
            : undefined,
        roles: instructor.professional ? instructor.professional.roles : [],
        sameAs: dedupeSameAs(instructor.social),
        courses: taughtCourses,
        seoContent: extendedContent,
        faqs: extendedContent ? extendedContent.faqAdditions : [],
        url: absoluteUrl(`/instructors/${instructor.slug}`, site.url)
    });
}

function getInstructorIds(course) {
    const ids = [];

    if (course.instructor) {
        ids.push(course.instructor);
    }

    if (Array.isArray(course.instructors)) {
        ids.push(...course.instructors);
    }

    return ids;
}

function dedupeSameAs(social) {
    return [...new Set(Object.values(social || {}).filter(Boolean))];
}
