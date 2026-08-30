import { describe, expect, it } from "vitest";
import { validateEntityGraph } from "../geo/validate.js";

describe("GEO entity graph validator", () => {
    it("accepts a canonical graph with valid references", () => {
        const result = validateEntityGraph({
            "@context": "https://schema.org",
            "@graph": [
                { "@id": "https://fatehmusic.ir/#organization", "@type": "MusicSchool" },
                {
                    "@id": "https://fatehmusic.ir/#website",
                    "@type": "WebSite",
                    publisher: { "@id": "https://fatehmusic.ir/#organization" }
                },
                { "@id": "https://fatehmusic.ir/courses/guitar/#course", "@type": "Course" },
                { "@id": "https://fatehmusic.ir/instructors/ali/#person", "@type": "Person" },
                {
                    "@id": "https://fatehmusic.ir/courses/guitar/#course-instance",
                    "@type": "CourseInstance",
                    about: { "@id": "https://fatehmusic.ir/courses/guitar/#course" },
                    instructor: { "@id": "https://fatehmusic.ir/instructors/ali/#person" }
                }
            ]
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it("detects duplicate IDs", () => {
        const result = validateEntityGraph({
            "@graph": [
                { "@id": "https://fatehmusic.ir/#organization" },
                { "@id": "https://fatehmusic.ir/#organization" },
                { "@id": "https://fatehmusic.ir/#website", publisher: { "@id": "https://fatehmusic.ir/#organization" } }
            ]
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Duplicate @id: https://fatehmusic.ir/#organization");
    });

    it("detects orphaned references", () => {
        const result = validateEntityGraph({
            "@graph": [
                { "@id": "https://fatehmusic.ir/#organization" },
                {
                    "@id": "https://fatehmusic.ir/#website",
                    publisher: { "@id": "https://fatehmusic.ir/#organization" }
                },
                {
                    "@id": "https://fatehmusic.ir/courses/guitar/#course-instance",
                    "@type": "CourseInstance",
                    about: { "@id": "https://fatehmusic.ir/courses/missing/#course" },
                    instructor: { "@id": "https://fatehmusic.ir/instructors/missing/#person" }
                }
            ]
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([
            "CourseInstance about reference is orphaned: https://fatehmusic.ir/courses/missing/#course",
            "CourseInstance instructor reference is orphaned: https://fatehmusic.ir/instructors/missing/#person"
        ]));
    });
});
