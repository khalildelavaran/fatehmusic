/**
 * Fateh Music Academy — SEO/GEO Engine v2
 * Global topical authority graph helpers.
 * URLs are emitted only for real public routes.
 */
import { courses } from "../../data/courses.js";
import { instructors } from "../../data/instructors.js";
import { absoluteUrl } from "../helpers/url.js";

export function buildSiteLinkCandidates(site) {
    const candidates = [];
    for (const course of courses.filter((item) => item.active !== false)) {
        candidates.push({ url: absoluteUrl(`/courses/${course.slug}`, site.url), title: course.title, type: "Course", topics: [course.instrument, course.category, ...(course.seo?.keywords || [])], priority: Number(course.priority || 10), local: true });
    }
    for (const instructor of instructors.filter((item) => item.active !== false)) {
        candidates.push({ url: absoluteUrl(`/instructors/${instructor.slug}`, site.url), title: instructor.name, type: "Instructor", topics: [...(instructor.professional?.roles || []), ...(instructor.seo?.keywords || []), "شوشتر"], priority: Number(instructor.priority || 20), local: true });
    }
    candidates.push(
        { url: site.url, title: site.name, type: "Organization", topics: [...site.keywords, "شوشتر", "آموزش موسیقی"], priority: 5, local: true },
        { url: absoluteUrl("/courses", site.url), title: "دوره‌های آموزش موسیقی", type: "CollectionPage", topics: ["آموزش موسیقی", "شوشتر"], priority: 15, local: true },
        { url: absoluteUrl("/instructors", site.url), title: "مدرس‌های موسیقی", type: "CollectionPage", topics: ["مدرس موسیقی", "شوشتر"], priority: 15, local: true },
        { url: absoluteUrl("/about", site.url), title: "درباره آموزشگاه موسیقی فاتح", type: "AboutPage", topics: ["آموزش موسیقی", "شوشتر"], priority: 8, local: true },
        { url: absoluteUrl("/contact", site.url), title: "تماس با آموزشگاه موسیقی فاتح", type: "ContactPage", topics: ["شوشتر", "آدرس", "تماس"], priority: 8, local: true },
        { url: absoluteUrl("/locations/shushtar", site.url), title: "آموزش موسیقی در شوشتر", type: "Place", topics: ["شوشتر", "آموزش موسیقی", "کلاس موسیقی"], priority: 6, local: true },
        { url: absoluteUrl("/register", site.url), title: "ثبت‌نام آموزشگاه موسیقی فاتح", type: "WebPage", topics: ["ثبت‌نام", "آموزش موسیقی", "شوشتر"], priority: 10, local: true }
    );
    return candidates;
}
