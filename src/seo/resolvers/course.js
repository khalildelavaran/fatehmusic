// @ts-check
/**
 * @typedef {import("../../types/courses").Course} Course
 */

/**
 * @typedef {import("../../types/courses").Instructor} Instructor
 */

/**
 * @typedef {{url:string}} Site
 */
import { courses } from "../../data/courses.js";
import { instructors } from "../../data/instructors.js";
import { pricing } from "../../data/pricing.js";
import { generateCourseFAQ } from "../../data/faq.js";
import { courseContent } from "../../data/course-content.js";
import { absoluteUrl } from "../helpers/url.js";


/**
 * @typedef {Object} ResolvedCourse
 * @property {number} id
 * @property {string} slug
 * @property {string} title
 * @property {string} description
 * @property {string} excerpt
 * @property {string} image
 * @property {string[]} level
 * @property {string[]} ageGroup
 * @property {string} classType
 * @property {string} instrument
 * @property {Instructor[]} instructors
 * @property {Object|null} plan
 * @property {Object} seo
 * @property {any|null} seoContent
 * @property {{question:string,answer:string}[]} faqs
 * @property {string} url
 */


/**
 * @param {string|Course} slugOrCourse
 * @param {Site} site
 * @returns {ResolvedCourse|null}
 */

export function resolveCourse(slugOrCourse, site) {

    const course =
        typeof slugOrCourse === "string"
            ? courses.find(
                (item) => item.slug === slugOrCourse
            )
            : slugOrCourse;


    if (!course) {
        return null;
    }


    const resolvedInstructors =
        instructors.filter((item) =>
            getInstructorIds(course).includes(item.id)
        );


	const planKey =
		pricing.coursePricingMap[
			/** @type {keyof typeof pricing.coursePricingMap} */
			(course.slug)
		];


	const plan =
		planKey &&
		planKey in pricing.plans
			? pricing.plans[
				/** @type {keyof typeof pricing.plans} */
				(planKey)
			  ]
			: null;


	const extendedContent =
		course.slug in courseContent
			? courseContent[
				/** @type {keyof typeof courseContent} */
				(course.slug)
			  ]
			: null;


return Object.freeze({
    id: course.id,
    slug: course.slug,
    title: course.title,

    description:
        course.content?.description ||
        course.description ||
        "",

    excerpt:
        course.content?.excerpt ||
        course.excerpt ||
        "",

    image:
        course.media?.cover ||
        course.media?.image ||
        "",

    level:
        course.level || [],

    ageGroup:
        course.ageGroup || [],

    classType:
        course.classType || "",

    instrument:
        course.instrument || "",

    instructors:
        resolvedInstructors,

    plan,

    seo:
        course.seo || {},

    seoContent:
        extendedContent,

    faqs: [
        ...generateCourseFAQ(course.id),
        ...(extendedContent?.faqAdditions || [])
    ],

    url: absoluteUrl(
        "/courses/" + course.slug,
        site.url
    )
});


}

/**
 * @param {Course} course
 * @returns {number[]}
 */
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