/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Instructor Resolver
 * --------------------------------------------------------
 */

import { instructors } from "../../data/instructors.js";
import { courses } from "../../data/courses.js";
import { absoluteUrl } from "../helpers/url.js";

/**
 * Resolves an instructor (by slug or raw object) into the
 * Instructor contract.
 *
 * @param {string|Object} slugOrInstructor
 * @param {import("./site.js").ResolvedSite} site
 * @returns {Object|null}
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
