/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Course Resolver
 * Description: Joins a raw course with its instructor(s),
 * pricing plan, and generated FAQ into one normalized object.
 * Handles both the single `instructor` id field and the
 * `instructors` array field used by a few courses.
 * --------------------------------------------------------
 */

import { courses } from "../../data/courses.js";
import { instructors } from "../../data/instructors.js";
import { pricing } from "../../data/pricing.js";
import { generateCourseFAQ } from "../../data/faq.js";
import { courseContent } from "../../data/course-content.js";
import { absoluteUrl } from "../helpers/url.js";

/**
 * Resolves a course (by slug or raw object) into the Course contract.
 *
 * @param {string|Object} slugOrCourse
 * @param {import("./site.js").ResolvedSite} site
 * @returns {Object|null}
 */
export function resolveCourse(slugOrCourse, site) {
    const course =
        typeof slugOrCourse === "string"
            ? courses.find((item) => item.slug === slugOrCourse)
            : slugOrCourse;

    if (!course) {
        return null;
    }

    const resolvedInstructors = instructors.filter((instructor) =>
        getInstructorIds(course).includes(instructor.id)
    );

    const planKey = pricing.coursePricingMap[course.slug];
    const plan = planKey ? pricing.plans[planKey] : null;

    // Optional long-form SEO/GEO content (course-content.js). Most
    // courses don't have an entry yet, so this is `null` for them —
    // every consumer (schema builders, page templates) must treat a
    // missing seoContent as "render without that section", not an error.
    const extendedContent = courseContent[course.slug] || null;

    return Object.freeze({
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.content.description,
        excerpt: course.content.excerpt,
        image: absoluteUrl(course.media.cover || course.media.image, site.url),
        level: course.level || [],
        ageGroup: course.ageGroup || [],
        classType: course.classType,
        instrument: course.instrument,
        instructors: resolvedInstructors,
        plan,
        seo: course.seo || {},
        seoContent: extendedContent,
        // Fact-derived logistics FAQ (price/schedule/format) first,
        // then hand-authored pedagogical FAQ, if this course has any.
        faqs: [
            ...generateCourseFAQ(course.id),
            ...(extendedContent ? extendedContent.faqAdditions : [])
        ],
        url: absoluteUrl(`/courses/${course.slug}`, site.url)
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
